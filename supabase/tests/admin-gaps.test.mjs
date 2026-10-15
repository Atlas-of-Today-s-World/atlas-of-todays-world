import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

/**
 * Admin gaps (migration 20261013000330_admin_gaps): an author's URL change
 * leaves a redirect behind, the link from an author profile to a team account
 * is set only by account managers (and audited), and roles are reordered in
 * one transaction by whoever may edit permissions.
 *
 * Run: npm run test:db
 */

const here = dirname(fileURLToPath(import.meta.url));
const migrations = join(here, "..", "migrations");
const db = new PGlite();

const id = {
  admin: "00000000-0000-4000-8000-000000000e01",
  accounts: "00000000-0000-4000-8000-000000000e02",
  editor: "00000000-0000-4000-8000-000000000e03",
  fixer: "00000000-0000-4000-8000-000000000e04",
  reader: "00000000-0000-4000-8000-000000000e05",
  publisher: "00000000-0000-4000-8000-000000000e06",
};

const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const one = async (sql, params = []) => (await q(sql, params))[0];

/** Expected database error; returns its message. */
async function refused(promise, pattern) {
  try {
    await promise;
  } catch (error) {
    if (pattern) assert.match(String(error.message), pattern);
    return error.message;
  }
  assert.fail("expected a refusal, but it went through");
}

/** Runs `fn` as a signed-in user with a second factor. */
async function as(user, fn) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${user}', false);
    select set_config('request.jwt.claims', '{"aal":"aal2"}', false);`);
  await db.exec("set role authenticated");
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);
      select set_config('request.jwt.claims', '', false);`);
  }
}

const redirect = (from) =>
  one("select to_path, permanent from redirects where from_path = $1", [from]);

before(async () => {
  await db.exec(readFileSync(join(here, "supabase-stubs.sql"), "utf8"));
  for (const file of readdirSync(migrations)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    try {
      await db.exec(readFileSync(join(migrations, file), "utf8"));
    } catch (error) {
      throw new Error(`${file}: ${error.message}`);
    }
  }
  // Edits every author's bio but may not add anything (no `news` "c", so no redirects by hand).
  await db.exec(`
    insert into roles (id, name, news_scope) values ('bio-fixer', 'Bio fixer', 'all');
    insert into role_permissions (role_id, section, actions) values ('bio-fixer', 'news', 've');
  `);
  const people = [
    [id.admin, "admin", "staff"],
    [id.accounts, "permission-admin", "staff"],
    [id.editor, "content-editor", "staff"],
    [id.fixer, "bio-fixer", "staff"],
    [id.reader, "reader", "reader"],
    [id.publisher, "publisher", "staff"],
  ];
  for (const [uid, role, kind] of people) {
    await q("insert into auth.users (id, email) values ($1, $2)", [
      uid,
      `${role}@atlasoftodaysworld.org`,
    ]);
    await q("update profiles set role_id = $2, kind = $3, status = 'active' where id = $1", [
      uid,
      role,
      kind,
    ]);
  }
});

// ---------------------------------------------------------------------------
// 1. Author URL changes
// ---------------------------------------------------------------------------

test("author slug: a change redirects the old URL, flattens chains and survives a rename back", async () => {
  const author = await one("insert into authors (name) values ('Ada Ames') returning id, slug");
  assert.equal(author.slug, "ada-ames");

  await as(id.fixer, async () => {
    const changed = await q("update authors set slug = 'ada-ames-k' where id = $1 returning slug", [
      author.id,
    ]);
    assert.equal(changed.length, 1, "news e + all entries may rename the URL");
  });
  assert.deepEqual(await redirect("/authors/ada-ames"), {
    to_path: "/authors/ada-ames-k",
    permanent: true,
  });

  await as(id.editor, () => q("update authors set slug = 'ada-k' where id = $1", [author.id]));
  // The first redirect now points straight at the newest URL (no chain).
  assert.equal((await redirect("/authors/ada-ames")).to_path, "/authors/ada-k");
  assert.equal((await redirect("/authors/ada-ames-k")).to_path, "/authors/ada-k");

  // Back to the original URL: it is live again, so nothing redirects away from it.
  await as(id.editor, () => q("update authors set slug = 'ada-ames' where id = $1", [author.id]));
  assert.equal(await redirect("/authors/ada-ames"), undefined);
  assert.equal((await redirect("/authors/ada-k")).to_path, "/authors/ada-ames");
  assert.equal((await redirect("/authors/ada-ames-k")).to_path, "/authors/ada-ames");

  // Saving the same slug again or another field leaves redirects alone.
  const count = async () => (await one("select count(*)::int as n from redirects")).n;
  const n = await count();
  await as(id.editor, () =>
    q("update authors set slug = 'ada-ames', bio = 'x' where id = $1", [author.id]),
  );
  assert.equal(await count(), n);
});

test("author slug: a publisher can't rename someone else's profile URL", async () => {
  const author = await one("insert into authors (name) values ('Bo Berg') returning id");
  await as(id.publisher, async () => {
    const changed = await q("update authors set slug = 'hijack' where id = $1 returning 1", [
      author.id,
    ]);
    assert.equal(changed.length, 0);
  });
  assert.equal(await redirect("/authors/bo-berg"), undefined);
});

// ---------------------------------------------------------------------------
// 2. Author ↔ team account
// ---------------------------------------------------------------------------

test("author account: only account managers link a profile, through set_author_account", async () => {
  const author = await one("insert into authors (name) values ('Cy Cole') returning id");

  // Writers link a new profile only to themselves, and never relink one directly.
  await as(id.editor, async () => {
    await refused(
      q("insert into authors (name, profile_id) values ('Theirs', $1)", [id.publisher]),
      /someone else's account/,
    );
    const own = await q(
      "insert into authors (name, slug, profile_id) values ('Mine', '', $1) returning id",
      [id.editor],
    );
    assert.equal(own.length, 1);
    await refused(
      q("update authors set profile_id = $2 where id = $1", [author.id, id.editor]),
      /permission denied/,
    );
    await refused(
      q("select set_author_account($1, $2)", [author.id, id.editor]),
      /Only account managers/,
    );
    await refused(q("select author_account($1)", [author.id]), /Only account managers/);
    // Writing the profile itself still works.
    const ok = await q(
      "insert into authors (name, slug, bio) values ('New', '', 'Hi') returning id",
    );
    assert.equal(ok.length, 1);
  });

  await as(id.accounts, async () => {
    await refused(
      q("select set_author_account($1, $2)", [author.id, id.reader]),
      /Only a team account/,
    );
    await q("select set_author_account($1, $2)", [author.id, id.publisher]);
    assert.equal((await one("select author_account($1) as p", [author.id])).p, id.publisher);
  });
  const audit = await one(
    "select actor, detail from audit_log where action = 'authors.account' and target = $1",
    [author.id],
  );
  assert.equal(audit.actor, id.accounts);
  assert.equal(audit.detail.to, id.publisher);

  // One author per account.
  const other = await one("insert into authors (name) values ('Di Dorn') returning id");
  await as(id.admin, () =>
    refused(
      q("select set_author_account($1, $2)", [other.id, id.publisher]),
      /already linked to the author Cy Cole/,
    ),
  );

  // The linked publisher may now edit that bio (policy authors_change).
  await as(id.publisher, async () => {
    const changed = await q("update authors set bio = 'Mine' where id = $1 returning 1", [
      author.id,
    ]);
    assert.equal(changed.length, 1);
  });

  // Unlinking.
  await as(id.admin, () => q("select set_author_account($1, null)", [author.id]));
  assert.equal(
    (await one("select profile_id from authors where id = $1", [author.id])).profile_id,
    null,
  );
});

test("author account: functions are not callable anonymously", async () => {
  for (const fn of [
    "set_author_account(uuid, uuid)",
    "author_account(uuid)",
    "move_role(text, boolean)",
  ]) {
    const anon = await one("select has_function_privilege('anon', $1, 'execute') as ok", [
      `public.${fn}`,
    ]);
    assert.equal(anon.ok, false, `anon may not execute ${fn}`);
    const user = await one("select has_function_privilege('authenticated', $1, 'execute') as ok", [
      `public.${fn}`,
    ]);
    assert.equal(user.ok, true, `authenticated may execute ${fn}`);
  }
  for (const fn of ["authors_slug_redirect()", "guard_author_account()"]) {
    const trigger = await one(
      "select has_function_privilege('authenticated', $1, 'execute') as ok",
      [`public.${fn}`],
    );
    assert.equal(trigger.ok, false, `${fn} is a trigger only`);
  }
});

// ---------------------------------------------------------------------------
// 3. Role order
// ---------------------------------------------------------------------------

const order = async () =>
  (await q("select id from roles where id <> 'reader' order by position, created_at, id")).map(
    (row) => row.id,
  );

test("roles: move_role swaps neighbours for permissions e, nobody else", async () => {
  await q(
    "insert into roles (id, name, position) values ('late-a', 'Late A', 80), ('late-b', 'Late B', 80)",
  );
  const start = await order();
  const at = start.indexOf("late-b");
  assert.ok(at > 0);

  await as(id.accounts, () => q("select move_role('late-b', true)"));
  const moved = await order();
  assert.equal(moved[at - 1], "late-b");
  assert.equal(moved[at], start[at - 1]);
  // Renumbered without ties; the reader role keeps its place.
  const positions = await q(
    "select id, position from roles where id <> 'reader' order by position",
  );
  assert.equal(new Set(positions.map((row) => row.position)).size, positions.length);
  assert.equal((await one("select position from roles where id = 'reader'")).position, 99);

  // Past the ends: nothing happens.
  const first = moved[0];
  await as(id.accounts, () => q("select move_role($1, true)", [first]));
  assert.deepEqual(await order(), moved);

  await as(id.editor, () => refused(q("select move_role('late-b', false)"), /can't reorder roles/));
  await as(id.accounts, () => refused(q("select move_role('nope', false)"), /no longer exists/));

  // Moving the roles with editorial reach is fine; reshaping them still needs an admin.
  await as(id.accounts, async () => {
    await q("select move_role('content-editor', false)");
    await refused(
      q("update roles set name = 'Editor', position = 5 where id = 'content-editor'"),
      /Only an admin/,
    );
  });
});
