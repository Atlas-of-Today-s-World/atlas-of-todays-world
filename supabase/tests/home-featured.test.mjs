import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

/**
 * Home map subtopics as an ordered list (migration 20261013000220_home_featured_items):
 * the two old slots are copied into the list, anyone reads the pins and the
 * tile count, only `site` or `news` "e" changes them, a subtopic is pinned at
 * most once and must exist, re-saving a topic keeps its pins and deleting a
 * subtopic for good unpins it.
 *
 * Run: npm run test:db
 */

const here = dirname(fileURLToPath(import.meta.url));
const migrations = join(here, "..", "migrations");
const THIS_MIGRATION = "20261013000220";
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
const MISSING = "00000000-0000-4000-8000-0000000000ff";

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

const pins = async () =>
  (await q("select chapter_id from home_featured_items order by position, id")).map(
    (row) => row.chapter_id,
  );
const pin = (chapter, position) =>
  q("insert into home_featured_items (chapter_id, position) values ($1, $2) returning id", [
    chapter,
    position,
  ]);

let old; // the topic pinned in the old slots before the migration

before(async () => {
  await db.exec(readFileSync(join(here, "supabase-stubs.sql"), "utf8"));
  const files = readdirSync(migrations)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  // Up to the previous migration, then pins in the old slots, then this one (expand copy).
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

  old = await topic("old-pins", ["First", "Second", "Third"]);
  // The old form: slot 1 = the third subtopic, slot 2 = the first.
  await q("update home_featured set first_chapter = $1, second_chapter = $2 where id = 1", [
    old.chapters[2],
    old.chapters[0],
  ]);

  await apply(files.filter((f) => f >= THIS_MIGRATION));
});

test("home featured: the two old slots are copied into the list in their order", async () => {
  assert.deepEqual(await pins(), [old.chapters[2], old.chapters[0]]);
  assert.deepEqual(
    (await q("select position from home_featured_items order by position")).map((r) => r.position),
    [10, 20],
  );
  // The old table stays (contract later), untouched.
  const slots = await one("select first_chapter, second_chapter from home_featured where id = 1");
  assert.equal(slots.first_chapter, old.chapters[2]);
});

test("home settings: two tiles by default, 1–6, a single row", async () => {
  assert.equal((await one("select featured_count from home_settings")).featured_count, 2);
  await refused(q("update home_settings set featured_count = 0"), /featured_count_check/);
  await refused(q("update home_settings set featured_count = 7"), /featured_count_check/);
  await refused(q("insert into home_settings (id, featured_count) values (2, 3)"), /id_check/);
});

test("home featured: anon and readers read pins and count, only the public columns", async () => {
  for (const user of [null, id.reader]) {
    const rows = await as(user, () =>
      q("select id, chapter_id, position from home_featured_items order by position"),
    );
    assert.equal(rows.length, 2);
    assert.equal(
      (await as(user, () => one("select featured_count from home_settings"))).featured_count,
      2,
    );
  }
  await refused(
    as(null, () => q("select created_at from home_featured_items")),
    /permission denied/,
  );
  await refused(
    as(null, () => pin(old.chapters[1], 30)),
    /permission denied/,
  );
  await refused(
    as(null, () => q("update home_settings set featured_count = 3")),
    /permission denied/,
  );
  await refused(
    as(null, () => q("delete from home_featured_items")),
    /permission denied/,
  );
});

test("home featured: news 'e' or site 'e' pins, reorders, unpins and sets the count", async () => {
  const third = old.chapters[1];
  for (const user of [id.editor, id.newsOnly, id.siteOnly, id.admin]) {
    const added = await as(user, () => pin(third, 30));
    assert.equal(added.length, 1, `user ${user}`);
    const moved = await as(user, () =>
      q("update home_featured_items set position = 5 where chapter_id = $1 returning id", [third]),
    );
    assert.equal(moved.length, 1, `user ${user}`);
    assert.equal((await pins())[0], third);
    const count = await as(user, () =>
      q("update home_settings set featured_count = 4 where id = 1 returning id"),
    );
    assert.equal(count.length, 1, `user ${user}`);
    const removed = await as(user, () =>
      q("delete from home_featured_items where chapter_id = $1 returning id", [third]),
    );
    assert.equal(removed.length, 1, `user ${user}`);
    await q("update home_settings set featured_count = 2");
  }
  assert.deepEqual(await pins(), [old.chapters[2], old.chapters[0]]);
});

test("home featured: without news or site 'e' nothing changes", async () => {
  const [first] = await pins();
  for (const user of [id.approver, id.dataEditor, id.reader]) {
    await refused(
      as(user, () => pin(old.chapters[1], 30)),
      /row-level security/,
    );
    const moved = await as(user, () =>
      q("update home_featured_items set position = 99 where chapter_id = $1 returning id", [first]),
    );
    assert.equal(moved.length, 0, `user ${user}`);
    const removed = await as(user, () => q("delete from home_featured_items returning id"));
    assert.equal(removed.length, 0, `user ${user}`);
    const count = await as(user, () =>
      q("update home_settings set featured_count = 5 where id = 1 returning id"),
    );
    assert.equal(count.length, 0, `user ${user}`);
  }
  assert.equal((await one("select featured_count from home_settings")).featured_count, 2);
  assert.equal((await pins()).length, 2);

  // Server-set columns stay the database's, even for an editor.
  await as(id.editor, async () => {
    await refused(
      q("update home_featured_items set chapter_id = $1", [MISSING]),
      /permission denied/,
    );
    await refused(q("update home_featured_items set created_at = now()"), /permission denied/);
    await refused(q("update home_settings set id = 2"), /permission denied/);
    await refused(q("delete from home_settings"), /permission denied/);
  });
});

test("home featured: a subtopic is pinned once, must exist, position 0–100,000", async () => {
  await as(id.editor, async () => {
    await refused(pin(old.chapters[0], 30), /home_featured_items_chapter_key/);
    await refused(pin(MISSING, 30), /home_featured_items_chapter_id_fkey/);
    await refused(pin(old.chapters[1], -1), /position_check/);
    await refused(pin(old.chapters[1], 100001), /position_check/);
  });
  assert.equal((await pins()).length, 2);
});

test("home featured: move_home_featured_item swaps neighbours, only with the right", async () => {
  const [a, b] = await pins();
  const idOf = async (chapter) =>
    (await one("select id from home_featured_items where chapter_id = $1", [chapter])).id;
  const bId = await idOf(b);

  await as(id.newsOnly, () => q("select move_home_featured_item($1, true)", [bId]));
  assert.deepEqual(await pins(), [b, a]);
  // Already first: nothing to do.
  await as(id.siteOnly, () => q("select move_home_featured_item($1, true)", [bId]));
  assert.deepEqual(await pins(), [b, a]);
  await as(id.siteOnly, () => q("select move_home_featured_item($1, false)", [bId]));
  assert.deepEqual(await pins(), [a, b]);

  await refused(
    as(id.approver, () => q("select move_home_featured_item($1, true)", [bId])),
    /can't reorder/,
  );
  await refused(
    as(null, () => q("select move_home_featured_item($1, true)", [bId])),
    /permission denied/,
  );
  await refused(
    as(id.editor, () => q("select move_home_featured_item($1, true)", [MISSING])),
    /no longer in the list/,
  );
  assert.deepEqual(await pins(), [a, b]);
});

test("home featured: re-saving a topic keeps its pins; a removed subtopic is unpinned", async () => {
  const saved = await topic("resaved", ["One", "Two"]);
  await pin(saved.chapters[1], 30);
  const items = (keep) =>
    JSON.stringify(keep.map((chapter, n) => ({ id: chapter, title: `Kept ${n}` })));

  // replace_entry_parts deletes and re-inserts the subtopics with the same ids.
  await as(id.editor, () =>
    q("select replace_entry_parts($1, 'chapters', $2::jsonb)", [
      saved.entry,
      items(saved.chapters),
    ]),
  );
  assert.ok((await pins()).includes(saved.chapters[1]));

  // Saved without the pinned subtopic: it is gone for good, and so is the pin.
  await as(id.editor, () =>
    q("select replace_entry_parts($1, 'chapters', $2::jsonb)", [
      saved.entry,
      items([saved.chapters[0]]),
    ]),
  );
  assert.ok(!(await pins()).includes(saved.chapters[1]));

  // Deleting a topic unpins its subtopics too (as the service key, no home right needed).
  await pin(saved.chapters[0], 40);
  await q("delete from entries where id = $1", [saved.entry]);
  assert.ok(!(await pins()).includes(saved.chapters[0]));
  assert.equal((await pins()).length, 2);
});

test("home featured: changes are stamped and land in the audit log", async () => {
  const [first] = await pins();
  const before = (
    await one("select updated_at from home_featured_items where chapter_id = $1", [first])
  ).updated_at;
  await as(id.editor, () =>
    q("update home_featured_items set position = 15 where chapter_id = $1", [first]),
  );
  const after = await one("select updated_at from home_featured_items where chapter_id = $1", [
    first,
  ]);
  assert.ok(after.updated_at >= before);
  const audit = await one(
    "select actor, detail from audit_log where action = 'home_featured_items.update' order by id desc limit 1",
  );
  assert.equal(audit.actor, id.editor);
  assert.equal(audit.detail.new.position, 15);
  await q("update home_featured_items set position = 10 where chapter_id = $1", [first]);

  await as(id.siteOnly, () => q("update home_settings set featured_count = 3"));
  const count = await one(
    "select actor, detail from audit_log where action = 'home_settings.update' order by id desc limit 1",
  );
  assert.equal(count.actor, id.siteOnly);
  assert.equal(count.detail.new.featured_count, 3);
  await q("update home_settings set featured_count = 2");
});
