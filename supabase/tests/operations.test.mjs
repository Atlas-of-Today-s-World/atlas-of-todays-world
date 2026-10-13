import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

/**
 * Operations (migration 20261013000140_operations):
 *  - site_notices: the maintenance message is site content — everyone reads
 *    the text, only `site` "e" changes it, nobody adds or removes the row;
 *  - feature_flags: the seeded Czech notes read in English; turning a switch
 *    and its note stay a `permissions` "e" right;
 *  - redirects: an existing redirect is edited with `news` "e" or `site` "e",
 *    the loop guard and the CHECKs hold on UPDATE, the author is kept, and the
 *    change is audited.
 * Same harness as rls.test.mjs: Supabase stubs + every migration in PGlite.
 *
 * Run: npm run test:db
 */

const here = dirname(fileURLToPath(import.meta.url));
const migrations = join(here, "..", "migrations");
const db = new PGlite();

const id = {
  permAdmin: "00000000-0000-4000-8000-000000000d01",
  editor: "00000000-0000-4000-8000-000000000d02",
  observer: "00000000-0000-4000-8000-000000000d03",
  siteOnly: "00000000-0000-4000-8000-000000000d04",
  reader: "00000000-0000-4000-8000-000000000d05",
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

/** Runs `fn` as a signed-in user with a second factor (null = anonymous reader). */
async function as(user, fn) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${user ?? ""}', false);
    select set_config('request.jwt.claims', '{"aal":"aal2"}', false);`);
  await db.exec(user ? "set role authenticated" : "set role anon");
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);
      select set_config('request.jwt.claims', '', false);`);
  }
}

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
  // A role that edits site content but has no say over articles (news "v").
  await db.exec(`
    insert into roles (id, name, news_scope) values ('site-only', 'Site only', 'none');
    insert into role_permissions (role_id, section, actions) values
      ('site-only', 'site', 'vce'), ('site-only', 'news', 'v');
  `);
  const people = [
    [id.permAdmin, "permission-admin", "staff"],
    [id.editor, "content-editor", "staff"],
    [id.observer, "observer", "staff"],
    [id.siteOnly, "site-only", "staff"],
    [id.reader, "reader", "reader"],
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

/** Sanity: the rights these tests rely on. */
test("operations: the test roles hold the rights the tests assume", async () => {
  const rights = async (user) =>
    as(user, () =>
      one(`select has_perm('news', 'e') news_e, has_perm('site', 'e') site_e,
                  has_perm('permissions', 'e') perm_e`),
    );
  assert.deepEqual({ ...(await rights(id.editor)) }, { news_e: true, site_e: true, perm_e: false });
  assert.deepEqual(
    { ...(await rights(id.siteOnly)) },
    { news_e: false, site_e: true, perm_e: false },
  );
  assert.deepEqual(
    { ...(await rights(id.observer)) },
    { news_e: false, site_e: false, perm_e: false },
  );
  assert.deepEqual(
    { ...(await rights(id.permAdmin)) },
    { news_e: false, site_e: false, perm_e: true },
  );
});

// ---------------------------------------------------------------------------
// site_notices
// ---------------------------------------------------------------------------

test("site_notices: one row, empty by default, readable by anyone", async () => {
  const rows = await as(null, () =>
    q("select maintenance_title, maintenance_text from site_notices"),
  );
  assert.deepEqual(
    rows.map((row) => ({ ...row })),
    [{ maintenance_title: "", maintenance_text: "" }],
  );
  await as(null, () => refused(q("select updated_by from site_notices"), /permission denied/));
  await as(id.reader, async () => {
    assert.equal((await q("select id from site_notices")).length, 1);
  });
});

test("site_notices: only site 'e' changes the message", async () => {
  await as(null, () =>
    refused(q("update site_notices set maintenance_title = 'x'"), /permission denied/),
  );
  for (const user of [id.reader, id.observer, id.permAdmin]) {
    const rows = await as(user, () =>
      q("update site_notices set maintenance_title = 'Nope' returning id"),
    );
    assert.equal(rows.length, 0, `user ${user} must not change it`);
  }
  const changed = await as(id.siteOnly, () =>
    q(
      "update site_notices set maintenance_title = 'Back soon', maintenance_text = 'Upgrading the map.' returning id",
    ),
  );
  assert.equal(changed.length, 1);
  const row = await one(
    "select maintenance_title, maintenance_text, updated_by from site_notices where id = 1",
  );
  assert.deepEqual(
    { ...row },
    {
      maintenance_title: "Back soon",
      maintenance_text: "Upgrading the map.",
      updated_by: id.siteOnly,
    },
  );
  const audit = await one(
    "select count(*)::int n from audit_log where action = 'site_notices.update' and target = '1'",
  );
  assert.equal(audit.n, 1);
});

test("site_notices: length CHECKs, no second row, no delete, no forged stamp", async () => {
  await as(id.editor, async () => {
    await refused(
      q("update site_notices set maintenance_title = repeat('a', 121)"),
      /check constraint/,
    );
    await refused(
      q("update site_notices set maintenance_text = repeat('a', 601)"),
      /check constraint/,
    );
    await refused(q("insert into site_notices (id) values (2)"), /permission denied/);
    await refused(q("delete from site_notices"), /permission denied/);
    await refused(q("update site_notices set updated_by = $1", [id.reader]), /permission denied/);
  });
  await refused(q("insert into site_notices (id) values (2)"), /check constraint/);
});

// ---------------------------------------------------------------------------
// feature_flags
// ---------------------------------------------------------------------------

test("feature_flags: the seeded notes are in English", async () => {
  const notes = await q("select key, note from feature_flags order by key");
  for (const { key, note } of notes) {
    assert.doesNotMatch(note, /[ěščřžýáíéůú]/i, `${key} note is still Czech: ${note}`);
  }
  assert.match(
    (await one("select note from feature_flags where key = 'maintenance'")).note,
    /maintenance notice/,
  );
});

test("feature_flags: switch and note stay a permissions 'e' right", async () => {
  for (const user of [id.editor, id.siteOnly]) {
    const rows = await as(user, () =>
      q(
        "update feature_flags set note = 'x', enabled = true where key = 'maintenance' returning key",
      ),
    );
    assert.equal(rows.length, 0, `user ${user} must not change a switch`);
  }
  const noted = await as(id.permAdmin, () =>
    q(
      "update feature_flags set note = 'Switched for the upgrade.' where key = 'newsletter' returning key",
    ),
  );
  assert.equal(noted.length, 1);
  await as(id.permAdmin, () =>
    refused(
      q("update feature_flags set note = repeat('a', 301) where key = 'newsletter'"),
      /check constraint/,
    ),
  );
});

// ---------------------------------------------------------------------------
// redirects
// ---------------------------------------------------------------------------

test("redirects: news 'e' or site 'e' edits an existing redirect, others can't", async () => {
  await as(id.editor, () =>
    q("insert into redirects (from_path, to_path) values ('/ops-old', '/ops-new')"),
  );
  const before = await one(
    "select id, created_by, created_at from redirects where from_path = '/ops-old'",
  );

  await as(null, () =>
    refused(
      q("update redirects set to_path = '/about' where from_path = '/ops-old'"),
      /permission denied/,
    ),
  );
  for (const user of [id.reader, id.observer, id.permAdmin]) {
    const rows = await as(user, () =>
      q("update redirects set to_path = '/about' where from_path = '/ops-old' returning id"),
    );
    assert.equal(rows.length, 0, `user ${user} must not edit a redirect`);
  }

  // site "e" without news "e" (owner decision: redirects are also site content).
  const bySite = await as(id.siteOnly, () =>
    q(
      "update redirects set to_path = '/about', permanent = false where from_path = '/ops-old' returning id",
    ),
  );
  assert.equal(bySite.length, 1);
  // news "e" (the section that has always owned redirects).
  const byNews = await as(id.editor, () =>
    q("update redirects set from_path = '/ops-older' where from_path = '/ops-old' returning id"),
  );
  assert.equal(byNews.length, 1);

  const after = await one(
    "select id, from_path, to_path, permanent, created_by, created_at, updated_at from redirects where id = $1",
    [before.id],
  );
  assert.equal(after.from_path, "/ops-older");
  assert.equal(after.to_path, "/about");
  assert.equal(after.permanent, false);
  assert.equal(after.created_by, id.editor, "the author is kept");
  assert.deepEqual(after.created_at, before.created_at);
  assert.ok(after.updated_at >= before.created_at);

  // Who created a redirect can't be rewritten (no column grant).
  await as(id.editor, () =>
    refused(
      q("update redirects set created_by = $1 where id = $2", [id.reader, before.id]),
      /permission denied/,
    ),
  );

  const audited = await q(
    "select target from audit_log where action = 'redirects.update' order by at",
  );
  assert.deepEqual(
    audited.map((row) => row.target),
    ["/ops-old", "/ops-older"],
  );
  await q("delete from redirects where id = $1", [before.id]);
});

test("redirects: CHECKs and the loop guard hold on UPDATE", async () => {
  await as(id.editor, async () => {
    await q("insert into redirects (from_path, to_path) values ('/ring-a', '/ring-b')");
    await q("insert into redirects (from_path, to_path) values ('/ring-b', '/ring-c#top')");
    await q("insert into redirects (from_path, to_path) values ('/ring-c', '/about')");

    // Closing the ring by editing the last hop.
    await refused(
      q("update redirects set to_path = '/ring-a?x=1' where from_path = '/ring-c'"),
      /loop back/,
    );
    // Pointing a redirect at itself.
    await refused(
      q("update redirects set to_path = '/ring-a' where from_path = '/ring-a'"),
      /check constraint|loop back/,
    );
    // Moving a redirect's source onto the end of the chain it points into:
    // /about → /ring-a → /ring-b → /ring-c → /about.
    await q("insert into redirects (from_path, to_path) values ('/ring-x', '/ring-a')");
    await refused(
      q("update redirects set from_path = '/about' where from_path = '/ring-x'"),
      /loop back/,
    );
    // Paths off the site.
    for (const [column, value] of [
      ["to_path", "https://evil.example"],
      ["to_path", "//evil.example"],
      ["from_path", "/"],
      ["from_path", "/trailing/"],
    ]) {
      await refused(
        q(`update redirects set ${column} = $1 where from_path = '/ring-b'`, [value]),
        /check constraint/,
      );
    }
  });
});

test("redirects: the row's own old version is no loop (swap its direction)", async () => {
  await as(id.editor, async () => {
    await q("insert into redirects (from_path, to_path) values ('/swap-a', '/swap-b')");
    // After the update only /swap-b → /swap-a exists: no loop.
    const rows = await q(
      "update redirects set from_path = '/swap-b', to_path = '/swap-a' where from_path = '/swap-a' returning id",
    );
    assert.equal(rows.length, 1);
  });
  await q("delete from redirects where from_path like '/swap-%' or from_path like '/ring-%'");
});
