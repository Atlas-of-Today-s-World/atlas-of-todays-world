import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

/**
 * The home map's tile count (home_settings, migration 20261013000220) and the
 * drop of the subtopic pins (20261019000100_drop_home_pins): anyone reads the
 * count, only `site` or `news` "e" changes it, 1–6 in a single row; the pin
 * tables, their move function and the unpin trigger are gone, and saving or
 * deleting a topic's subtopics still works.
 *
 * Run: npm run test:db
 */

const here = dirname(fileURLToPath(import.meta.url));
const migrations = join(here, "..", "migrations");
const THIS_MIGRATION = "20261019000100";
const db = new PGlite();

const id = {
  admin: "00000000-0000-4000-8000-000000000e01",
  editor: "00000000-0000-4000-8000-000000000e02",
  newsOnly: "00000000-0000-4000-8000-000000000e03",
  siteOnly: "00000000-0000-4000-8000-000000000e04",
  approver: "00000000-0000-4000-8000-000000000e05",
  dataEditor: "00000000-0000-4000-8000-000000000e06",
  reader: "00000000-0000-4000-8000-000000000e07",
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

async function apply(files) {
  for (const file of files) {
    try {
      await db.exec(readFileSync(join(migrations, file), "utf8"));
    } catch (error) {
      throw new Error(`${file}: ${error.message}`);
    }
  }
}

/** A topic with subtopics (by the content editor); returns the subtopic ids in order. */
async function topic(slug, titles) {
  const entry = await one(
    `insert into entries (slug, title, summary, category, region_slug, owner_id, status)
     values ($1, $1, 'Summary', 'Society', 'east-asia', $2, 'draft') returning id`,
    [slug, id.editor],
  );
  const chapters = [];
  for (const [position, title] of titles.entries()) {
    chapters.push(
      (
        await one(
          "insert into entry_chapters (entry_id, position, title) values ($1, $2, $3) returning id",
          [entry.id, position, title],
        )
      ).id,
    );
  }
  return { entry: entry.id, chapters };
}

let pinned; // a topic whose subtopics were pinned before the drop

before(async () => {
  await db.exec(readFileSync(join(here, "supabase-stubs.sql"), "utf8"));
  const files = readdirSync(migrations)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  // Up to the previous migration, then pins in both old tables, then the drop.
  await apply(files.filter((f) => f < THIS_MIGRATION));

  await db.exec(`
    insert into regions (slug, name, fill, stroke, center_lon, center_lat) values
      ('east-asia', 'East Asia', '#aaaaaa', '#555555', 110, 35);
    insert into roles (id, name) values ('news-only', 'News only'), ('site-only', 'Site only');
    insert into role_permissions (role_id, section, actions) values
      ('news-only', 'news', 've'), ('site-only', 'site', 've');
  `);
  const people = [
    [id.admin, "admin", "staff"],
    [id.editor, "content-editor", "staff"],
    [id.newsOnly, "news-only", "staff"],
    [id.siteOnly, "site-only", "staff"],
    [id.approver, "content-approver", "staff"],
    [id.dataEditor, "data-editor", "staff"],
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

  pinned = await topic("pinned", ["First", "Second"]);
  await q("update home_featured set first_chapter = $1 where id = 1", [pinned.chapters[0]]);
  await q("insert into home_featured_items (chapter_id, position) values ($1, 10), ($2, 20)", [
    pinned.chapters[1],
    pinned.chapters[0],
  ]);

  await apply(files.filter((f) => f >= THIS_MIGRATION));
});

test("home pins: the tables, the move function and the unpin trigger are gone", async () => {
  const tables = await q(
    `select tablename from pg_tables where schemaname = 'public'
       and tablename in ('home_featured', 'home_featured_items', 'home_settings')`,
  );
  assert.deepEqual(
    tables.map((row) => row.tablename),
    ["home_settings"],
  );
  const fns = await q(
    `select proname from pg_proc where pronamespace = 'public'::regnamespace
       and proname in ('move_home_featured_item', 'unpin_removed_chapter')`,
  );
  assert.deepEqual(fns, []);
  const triggers = await q(
    `select tgname from pg_trigger
      where tgrelid = 'public.entry_chapters'::regclass and tgname like '%home%'`,
  );
  assert.deepEqual(triggers, []);
});

test("home pins: re-saving and deleting subtopics of a once pinned topic works", async () => {
  const items = (keep) =>
    JSON.stringify(keep.map((chapter, n) => ({ id: chapter, title: `Kept ${n}` })));
  await as(id.editor, () =>
    q("select replace_entry_parts($1, 'chapters', $2::jsonb)", [
      pinned.entry,
      items(pinned.chapters),
    ]),
  );
  await as(id.editor, () =>
    q("select replace_entry_parts($1, 'chapters', $2::jsonb)", [
      pinned.entry,
      items([pinned.chapters[0]]),
    ]),
  );
  const left = await q("select id from entry_chapters where entry_id = $1", [pinned.entry]);
  assert.deepEqual(
    left.map((row) => row.id),
    [pinned.chapters[0]],
  );
  await q("delete from entries where id = $1", [pinned.entry]);
  assert.equal(
    (await one("select count(*)::int as n from entry_chapters where entry_id = $1", [pinned.entry]))
      .n,
    0,
  );
});

test("home settings: two tiles by default, 1–6, a single row", async () => {
  assert.equal((await one("select featured_count from home_settings")).featured_count, 2);
  await refused(q("update home_settings set featured_count = 0"), /featured_count_check/);
  await refused(q("update home_settings set featured_count = 7"), /featured_count_check/);
  await refused(q("insert into home_settings (id, featured_count) values (2, 3)"), /id_check/);
});

test("home settings: anon and readers read the count, never change it", async () => {
  for (const user of [null, id.reader]) {
    assert.equal(
      (await as(user, () => one("select featured_count from home_settings"))).featured_count,
      2,
    );
  }
  await refused(
    as(null, () => q("update home_settings set featured_count = 3")),
    /permission denied/,
  );
});

test("home settings: news 'e' or site 'e' sets the count, nobody else", async () => {
  for (const user of [id.editor, id.newsOnly, id.siteOnly, id.admin]) {
    const count = await as(user, () =>
      q("update home_settings set featured_count = 4 where id = 1 returning id"),
    );
    assert.equal(count.length, 1, `user ${user}`);
    await q("update home_settings set featured_count = 2");
  }
  for (const user of [id.approver, id.dataEditor, id.reader]) {
    const count = await as(user, () =>
      q("update home_settings set featured_count = 5 where id = 1 returning id"),
    );
    assert.equal(count.length, 0, `user ${user}`);
  }
  assert.equal((await one("select featured_count from home_settings")).featured_count, 2);

  // Server-set columns and the row itself stay the database's, even for an editor.
  await as(id.editor, async () => {
    await refused(q("update home_settings set id = 2"), /permission denied/);
    await refused(q("delete from home_settings"), /permission denied/);
  });
});

test("home settings: a change lands in the audit log", async () => {
  await as(id.siteOnly, () => q("update home_settings set featured_count = 3"));
  const count = await one(
    "select actor, detail from audit_log where action = 'home_settings.update' order by id desc limit 1",
  );
  assert.equal(count.actor, id.siteOnly);
  assert.equal(count.detail.new.featured_count, 3);
  await q("update home_settings set featured_count = 2");
});
