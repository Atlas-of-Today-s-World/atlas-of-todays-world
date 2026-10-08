import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

/**
 * Admin queries moved into the database (review 2026-10-07, D-M2 + D-M4):
 * lean entry revisions with retention, and role holder counts.
 * Same harness as rls.test.mjs: Supabase stubs + every migration in PGlite.
 *
 * Run: npm run test:db
 */

const here = dirname(fileURLToPath(import.meta.url));
const migrations = join(here, "..", "migrations");
const db = new PGlite();

const id = {
  admin: "00000000-0000-4000-8000-000000000001",
  permViewer: "00000000-0000-4000-8000-000000000002",
  editor: "00000000-0000-4000-8000-000000000003",
  reader: "00000000-0000-4000-8000-000000000004",
  gone: "00000000-0000-4000-8000-000000000005",
};

/** Runs `fn` as a signed-in user (null = anonymous reader) with a second factor. */
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

async function newEntry(slug, status = "draft") {
  const row = await one(
    `insert into entries (slug, title, summary, category, region_slug, owner_id, status)
     values ($1, $1, 'Summary', 'Society', 'east-asia', $2, $3) returning id`,
    [slug, id.editor, status],
  );
  return row.id;
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
  await db.exec(`
    insert into regions (slug, name, fill, stroke, center_lon, center_lat) values
      ('east-asia', 'East Asia', '#aaaaaa', '#555555', 110, 35);
  `);

  // A role that may view permissions but not accounts: profiles RLS shows it only itself.
  await q(
    "insert into role_permissions (role_id, section, actions) values ('observer', 'permissions', 'v')",
  );
  const people = [
    [id.admin, "admin@atlasoftodaysworld.org", "admin", "staff"],
    [id.permViewer, "perm.viewer@atlasoftodaysworld.org", "observer", "staff"],
    [id.editor, "editor@atlasoftodaysworld.org", "content-editor", "staff"],
    [id.reader, "reader@example.org", "reader", "reader"],
    [id.gone, "gone@example.org", "reader", "reader"],
  ];
  for (const [uid, email, role, kind] of people) {
    await q("insert into auth.users (id, email) values ($1, $2)", [uid, email]);
    await q("update profiles set role_id = $2, kind = $3, status = 'active' where id = $1", [
      uid,
      role,
      kind,
    ]);
  }
  await q("update profiles set deleted_at = now() where id = $1", [id.gone]);
});

// ---------------------------------------------------------------------------
// Entry revisions (D-M2)
// ---------------------------------------------------------------------------

test("revision snapshots leave out the generated search vector", async () => {
  const entry = await newEntry("lean-revision");
  await q("update entries set body_html = '<p>changed</p>' where id = $1", [entry]);
  const revision = await one(
    `select snapshot ? 'search' as has_search, snapshot ->> 'title' as title
     from entry_revisions where entry_id = $1`,
    [entry],
  );
  assert.deepEqual(revision, { has_search: false, title: "lean-revision" });
});

test("pruning keeps the newest 50 revisions plus the newest published one", async () => {
  const entry = await newEntry("many-revisions");
  // 60 revisions, one per minute; #3 and #5 were saved while live (#5 is the newer).
  for (let n = 1; n <= 60; n++) {
    const status = n === 3 || n === 5 ? "published" : "draft";
    await q(
      `insert into entry_revisions (entry_id, saved_at, snapshot)
       values ($1, now() - make_interval(mins => 100 - $2::int), jsonb_build_object('title', $3::text, 'status', $4::text))`,
      [entry, n, `v${n}`, status],
    );
  }
  const other = await newEntry("few-revisions");
  await q(
    `insert into entry_revisions (entry_id, snapshot)
     select $1, jsonb_build_object('title', 'w' || n, 'status', 'draft') from generate_series(1, 5) n`,
    [other],
  );

  const removed = await one("select public.prune_entry_revisions() as n");
  assert.equal(removed.n, 9, "v1–v10 minus the newest published v5");
  const kept = await q(
    "select snapshot ->> 'title' as title from entry_revisions where entry_id = $1 order by saved_at",
    [entry],
  );
  assert.equal(kept.length, 51);
  assert.equal(kept[0].title, "v5");
  assert.equal(kept[1].title, "v11");
  const untouched = await one(
    "select count(*)::int as n from entry_revisions where entry_id = $1",
    [other],
  );
  assert.equal(untouched.n, 5);

  const housekeeping = await one("select public.db_housekeeping() as r");
  assert.equal(housekeeping.r.entry_revisions, 0, "already pruned");
  await as(id.admin, () =>
    refused(q("select public.prune_entry_revisions()"), /permission denied/),
  );
});

// ---------------------------------------------------------------------------
// Role holder counts (D-M4)
// ---------------------------------------------------------------------------

const directCounts = () =>
  q(`select role_id, count(*)::int as holders from profiles
     where deleted_at is null group by role_id order by role_id`);
const rpcCounts = () =>
  q("select role_id, holders::int as holders from public.role_holder_counts() order by role_id");

test("role holder counts match a direct count of live accounts", async () => {
  const expected = await directCounts();
  assert.ok(
    expected.some((row) => row.role_id === "reader" && row.holders === 1),
    "deleted left out",
  );
  assert.deepEqual(await as(id.admin, rpcCounts), expected);
});

test("permission viewer gets full counts although profiles RLS shows only themselves", async () => {
  const expected = await directCounts();
  const visible = await as(id.permViewer, () => one("select count(*)::int as n from profiles"));
  assert.equal(visible.n, 1);
  assert.deepEqual(await as(id.permViewer, rpcCounts), expected);
});

test("role holder counts are refused without permissions view", async () => {
  await as(id.editor, () => refused(rpcCounts(), /may view permissions/));
  await as(id.reader, () => refused(rpcCounts(), /may view permissions/));
  await as(null, () => refused(rpcCounts(), /permission denied/));
});
