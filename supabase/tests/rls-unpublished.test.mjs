import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

/**
 * Unpublished entries: the read policies check the user once per query and the
 * owner per row (migration 20261008000100), instead of calling
 * can_read_unpublished(owner_id) / can_read_entry(entry_id) for every row.
 *
 * This is a differential test: for every kind of account and every entry in
 * every status, the rows each read policy lets through must be exactly the
 * rows the previous policy expressions (built on can_read_unpublished and
 * can_read_entry, which still exist) would have let through. The previous
 * expressions are evaluated as the superuser with the same JWT claims.
 *
 * Run: npm run test:db
 */

const here = dirname(fileURLToPath(import.meta.url));
const migrations = join(here, "..", "migrations");
const db = new PGlite();

const id = {
  admin: "00000000-0000-4000-8000-000000000001",
  permAdmin: "00000000-0000-4000-8000-000000000002",
  editor: "00000000-0000-4000-8000-000000000003",
  pubA: "00000000-0000-4000-8000-000000000004",
  pubB: "00000000-0000-4000-8000-000000000005",
  approverLatam: "00000000-0000-4000-8000-000000000006",
  approverAsia: "00000000-0000-4000-8000-000000000007",
  dataEditor: "00000000-0000-4000-8000-000000000008",
  reader: "00000000-0000-4000-8000-000000000009",
  blocked: "00000000-0000-4000-8000-00000000000a",
  observer: "00000000-0000-4000-8000-00000000000b",
  ownViewer: "00000000-0000-4000-8000-00000000000c",
  noneViewer: "00000000-0000-4000-8000-00000000000d",
  scopeOnly: "00000000-0000-4000-8000-00000000000e",
  deleted: "00000000-0000-4000-8000-00000000000f",
  // Signed in, but no profile (e.g. a removed account with a still-valid token).
  ghost: "00000000-0000-4000-8000-0000000000ff",
};

/** Who is asking: a user id (null = anonymous) and the session's assurance level. */
const sessions = [
  { name: "anon", user: null },
  ...Object.entries(id).map(([name, user]) => ({ name, user })),
  // Admin requires a second factor: without it the account counts as inactive.
  { name: "admin-aal1", user: id.admin, aal: "aal1" },
  { name: "editor-aal1", user: id.editor, aal: "aal1" },
];

const owners = [id.pubA, id.pubB, id.editor, id.admin, id.ownViewer, id.blocked, id.reader, null];
const statuses = ["planned", "draft", "pending", "published"];

const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const one = async (sql, params = []) => (await q(sql, params))[0];

async function setClaims(user, aal) {
  await db.exec(`select set_config('request.jwt.claim.sub', '${user ?? ""}', false);
    select set_config('request.jwt.claims', '{"aal":"${aal}"}', false);`);
}

async function clearClaims() {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);
    select set_config('request.jwt.claims', '', false);`);
}

/** Runs `fn` as the signed-in user (null = anonymous reader), under RLS. */
async function as(user, fn, { aal = "aal2" } = {}) {
  await db.exec("reset role");
  await setClaims(user, aal);
  await db.exec(user ? "set role authenticated" : "set role anon");
  try {
    return await fn();
  } finally {
    await clearClaims();
  }
}

/** Runs `fn` as the superuser (no RLS) with the user's claims, for the reference results. */
async function claimsOnly(user, fn, { aal = "aal2" } = {}) {
  await db.exec("reset role");
  await setClaims(user, aal);
  try {
    return await fn();
  } finally {
    await clearClaims();
  }
}

/**
 * Each read policy that changed: the rows the caller gets, and the previous
 * policy expression (before 20261008000100) as the reference. `old_entries`
 * stands for `entries` as the caller saw it through the previous entries_read /
 * entries_public policy, since the child policies join `entries` under RLS.
 */
const tables = [
  {
    table: "entries",
    key: "id::text",
    signedIn: "(status = 'published' and is_staff()) or can_read_unpublished(owner_id)",
    anon: "status = 'published'",
  },
  {
    table: "entry_chapters",
    key: "id::text",
    signedIn: `exists (select 1 from old_entries e where e.id = entry_id
                 and (e.status = 'published' or can_read_unpublished(e.owner_id)))`,
    anon: "exists (select 1 from old_entries e where e.id = entry_id and e.status = 'published')",
  },
  {
    table: "entry_countries",
    key: "entry_id::text || country_iso3",
    signedIn: `exists (select 1 from old_entries e where e.id = entry_id
                 and (e.status = 'published' or can_read_unpublished(e.owner_id)))`,
    anon: "exists (select 1 from old_entries e where e.id = entry_id and e.status = 'published')",
  },
  {
    table: "resources",
    key: "id::text",
    signedIn: `entry_id is null or exists (select 1 from old_entries e where e.id = entry_id
                 and (e.status = 'published' or can_read_unpublished(e.owner_id)))`,
    anon: `entry_id is null
           or exists (select 1 from old_entries e where e.id = entry_id and e.status = 'published')`,
  },
  {
    table: "preview_links",
    key: "id::text",
    signedIn: `exists (select 1 from old_entries e where e.id = entry_id
                 and can_read_unpublished(e.owner_id))`,
    anon: null, // anon has no access to preview links at all
  },
  {
    table: "entry_faq",
    key: "id::text",
    signedIn: "can_read_entry(entry_id)",
    anon: "can_read_entry(entry_id)",
  },
  {
    table: "learn_more_tiles",
    key: "id::text",
    signedIn: "entry_id is not null and can_read_entry(entry_id)",
    anon: "entry_id is not null and can_read_entry(entry_id)",
  },
  {
    table: "entry_tile_notes",
    key: "entry_id::text || tile_id::text",
    signedIn: "can_read_entry(entry_id)",
    anon: "can_read_entry(entry_id)",
  },
];

const sorted = (rows) => rows.map((r) => r.k).sort();

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

  await db.exec(`
    insert into regions (slug, name, fill, stroke, center_lon, center_lat) values
      ('latin-america-caribbean', 'Latin America & Caribbean', '#aaaaaa', '#555555', -60, -10);
    insert into countries (iso3, slug, name, region_slug) values
      ('BRA', 'brazil', 'Brazil', 'latin-america-caribbean');
    -- Every branch of the news-scope rule: news 'v' with scope own / none / all,
    -- and scope 'all' without the news right.
    insert into roles (id, name, news_scope) values
      ('own-viewer', 'Own viewer', 'own'),
      ('none-viewer', 'None viewer', 'none'),
      ('scope-only', 'Scope only', 'all');
    insert into role_permissions (role_id, section, actions) values
      ('own-viewer', 'news', 'v'),
      ('none-viewer', 'news', 'v');
  `);

  const people = [
    [id.admin, "admin", "staff", "active"],
    [id.permAdmin, "permission-admin", "staff", "active"],
    [id.editor, "content-editor", "staff", "active"],
    [id.pubA, "publisher", "staff", "active"],
    [id.pubB, "publisher", "staff", "active"],
    [id.approverLatam, "content-approver", "staff", "active"],
    [id.approverAsia, "content-approver", "staff", "active"],
    [id.dataEditor, "data-editor", "staff", "active"],
    [id.reader, "reader", "reader", "active"],
    [id.blocked, "publisher", "staff", "blocked"],
    [id.observer, "observer", "staff", "active"],
    [id.ownViewer, "own-viewer", "staff", "active"],
    [id.noneViewer, "none-viewer", "staff", "active"],
    [id.scopeOnly, "scope-only", "staff", "active"],
    [id.deleted, "content-editor", "staff", "active"],
  ];
  for (const [uid, role, kind, status] of people) {
    await q("insert into auth.users (id, email) values ($1, $2)", [
      uid,
      `${role}-${uid}@example.org`,
    ]);
    await q("update profiles set role_id = $2, kind = $3, status = $4 where id = $1", [
      uid,
      role,
      kind,
      status,
    ]);
  }
  await q("update profiles set deleted_at = now() where id = $1", [id.deleted]);
  await q("insert into approver_countries values ($1, 'BRA')", [id.approverLatam]);
  await q("insert into approver_authors values ($1, $2)", [id.approverLatam, id.pubB]);

  // One entry per owner and status, each with a row in every child table.
  let n = 0;
  for (const owner of owners) {
    for (const status of statuses) {
      n += 1;
      const slug = `diff-${n}`;
      const { id: entry } = await one(
        `insert into entries (slug, title, summary, category, region_slug, owner_id, status)
         values ($1, $1, 'Summary', 'Society', 'latin-america-caribbean', $2, $3) returning id`,
        [slug, owner, status],
      );
      await q("insert into entry_countries (entry_id, country_iso3) values ($1, 'BRA')", [entry]);
      await q("insert into entry_chapters (entry_id, position, title) values ($1, 0, 'One')", [
        entry,
      ]);
      await q(
        `insert into resources (entry_id, kind, title, url)
         values ($1, 'Lectures & Debates', 'Talk', 'https://example.org')`,
        [entry],
      );
      await q(
        `insert into preview_links (entry_id, token_hash, expires_at)
         values ($1, md5($2) || md5($2 || 'x'), now() + interval '1 day')`,
        [entry, slug],
      );
      await q(
        "insert into entry_faq (entry_id, position, question, answer) values ($1, 0, 'Q?', 'A.')",
        [entry],
      );
      const { id: tile } = await one(
        "insert into learn_more_tiles (entry_id, slug, label) values ($1, 'notes', 'Notes') returning id",
        [entry],
      );
      await q(
        "insert into entry_tile_notes (entry_id, tile_id, body_html) values ($1, $2, '<p>x</p>')",
        [entry, tile],
      );
    }
  }
  // A shared resource (no entry) — every signed-in user and anon read it.
  await q(
    `insert into resources (region_slug, kind, title, url)
     values ('latin-america-caribbean', 'Lectures & Debates', 'Shared', 'https://example.org')`,
  );
});

// ---------------------------------------------------------------------------

for (const { table, key, signedIn, anon } of tables) {
  test(`${table}: every account reads exactly what can_read_unpublished allowed`, async () => {
    for (const { name, user, aal } of sessions) {
      const reference = user ? signedIn : anon;
      if (!reference) continue;
      const oldEntries = user
        ? "(status = 'published' and is_staff()) or can_read_unpublished(owner_id)"
        : "status = 'published'";

      const actual = sorted(await as(user, () => q(`select ${key} as k from ${table}`), { aal }));
      const expected = sorted(
        await claimsOnly(
          user,
          () =>
            q(
              `with old_entries as (select * from entries where ${oldEntries})
               select ${key} as k from ${table} where ${reference}`,
            ),
          { aal },
        ),
      );
      assert.deepEqual(actual, expected, `${table} as ${name}`);
    }
  });
}

test("the reference really tells accounts apart (the comparison isn't vacuous)", async () => {
  const visible = async (user, opts) =>
    (await as(user, () => one("select count(*)::int as n from entries"), opts)).n;
  const all = owners.length * statuses.length;
  const published = owners.length;
  assert.equal(await visible(id.admin), all);
  assert.equal(await visible(id.editor), all);
  assert.equal(await visible(id.observer), all, "news 'v' with scope 'none' reads every draft");
  assert.equal(await visible(id.noneViewer), all);
  assert.equal(await visible(id.approverAsia), all, "approvals 'v' reads every draft");
  assert.equal(await visible(id.pubA), published + statuses.length - 1, "published + own drafts");
  assert.equal(await visible(id.ownViewer), published + statuses.length - 1);
  assert.equal(await visible(id.scopeOnly), published, "scope 'all' without the news right");
  assert.equal(await visible(id.permAdmin), published);
  // Readers read the public site through anon; through the session only their own entries.
  assert.equal(await visible(id.reader), statuses.length);
  assert.equal(await visible(id.blocked), 0);
  assert.equal(await visible(id.deleted), 0);
  assert.equal(await visible(id.ghost), 0);
  assert.equal(await visible(id.admin, { aal: "aal1" }), 0, "admin without a second factor");
  assert.equal(await visible(null), published);
  // A reader (non-staff) still reads the FAQ of every published entry through the
  // session (can_read_entry bypasses entries' RLS), plus that of their own drafts.
  const faq = await as(id.reader, () => one("select count(*)::int as n from entry_faq"));
  assert.equal(faq.n, published + statuses.length - 1);
});

test("the split helpers equal can_read_unpublished / can_read_entry for every entry", async () => {
  for (const { name, user, aal } of sessions) {
    if (!user) continue;
    const mismatches = await claimsOnly(
      user,
      () =>
        q(`select e.slug from entries e
            where can_read_unpublished(e.owner_id)
                  is distinct from (can_read_any_unpublished()
                                    or coalesce(e.owner_id = auth.uid() and is_active(), false))
               or can_read_entry(e.id)
                  is distinct from (can_read_any_unpublished() or entry_published_or_own(e.id))`),
      { aal },
    );
    assert.deepEqual(mismatches, [], `as ${name}`);
  }
});

test("no read policy calls the per-row helpers any more; the user check runs once per query", async () => {
  const perRow = await q(
    String.raw`select tablename || '.' || policyname as policy from pg_policies
     where schemaname = 'public' and cmd = 'SELECT'
       and coalesce(qual, '') ~ '\m(can_read_unpublished|can_read_entry)\('`,
  );
  assert.deepEqual(
    perRow.map((r) => r.policy),
    [],
  );
  const bare = await q(
    String.raw`select tablename || '.' || policyname as policy from pg_policies
     where schemaname = 'public'
       and coalesce(qual, '') || ' ' || coalesce(with_check, '') ~ $re$(?<!SELECT )\mcan_read_any_unpublished\(\)$re$`,
  );
  assert.deepEqual(
    bare.map((r) => r.policy),
    [],
  );
});

test("anon can't call the new helpers", async () => {
  await as(null, async () => {
    for (const call of [
      "select public.can_read_any_unpublished()",
      "select public.entry_published_or_own(gen_random_uuid())",
    ]) {
      await assert.rejects(q(call), /permission denied/);
    }
  });
});
