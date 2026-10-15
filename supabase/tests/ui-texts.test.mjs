import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

/**
 * UI text overrides (migration 20261013000280_ui_text_overrides): everyone
 * reads the key and the text, section `site` decides every write (c insert,
 * e update, d delete), who changed it stays internal, the CHECKs refuse
 * malformed keys and markup, and every change is in the audit log.
 *
 * Run: npm run test:db
 */

const here = dirname(fileURLToPath(import.meta.url));
const migrations = join(here, "..", "migrations");
const db = new PGlite();

const id = {
  admin: "00000000-0000-4000-8000-000000000e01",
  editor: "00000000-0000-4000-8000-000000000e02",
  observer: "00000000-0000-4000-8000-000000000e03",
  reader: "00000000-0000-4000-8000-000000000e04",
  viewer: "00000000-0000-4000-8000-000000000e05",
  creator: "00000000-0000-4000-8000-000000000e06",
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

const value = (key) =>
  one("select value from ui_text_overrides where key = $1", [key]).then((row) => row?.value);

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
  // Custom roles: one may only look at site content, one may only add (c, no e/d).
  await db.exec(`
    insert into roles (id, name, news_scope) values ('site-viewer', 'Site viewer', 'own');
    insert into role_permissions (role_id, section, actions) values ('site-viewer', 'site', 'v');
    insert into roles (id, name, news_scope) values ('site-creator', 'Site creator', 'own');
    insert into role_permissions (role_id, section, actions) values ('site-creator', 'site', 'vc');
  `);
  const people = [
    [id.admin, "admin", "staff"],
    [id.editor, "content-editor", "staff"],
    [id.observer, "observer", "staff"],
    [id.reader, "reader", "reader"],
    [id.viewer, "site-viewer", "staff"],
    [id.creator, "site-creator", "staff"],
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

test("ui texts: empty at deploy — the site shows en.json until the team changes something", async () => {
  assert.equal((await one("select count(*)::int n from ui_text_overrides")).n, 0);
});

test("ui texts: an editor with site c/e/d adds, changes and resets; it is audited", async () => {
  await as(id.editor, () =>
    q("insert into ui_text_overrides (key, value) values ('home.title', 'The world today')"),
  );
  const row = await one(
    "select updated_by, updated_at from ui_text_overrides where key = 'home.title'",
  );
  assert.equal(row.updated_by, id.editor, "who changed it is stamped");

  await as(id.editor, () =>
    q("update ui_text_overrides set value = 'The world, today' where key = 'home.title'"),
  );
  assert.equal(await value("home.title"), "The world, today");

  await as(id.editor, () => q("delete from ui_text_overrides where key = 'home.title'"));
  assert.equal(await value("home.title"), undefined);

  const actions = (
    await q("select action from audit_log where target = 'home.title' order by id")
  ).map((entry) => entry.action);
  assert.deepEqual(actions, [
    "ui_text_overrides.insert",
    "ui_text_overrides.update",
    "ui_text_overrides.delete",
  ]);
});

test("ui texts: anon and every signed-in user read key and text; only the team sees who", async () => {
  await q("insert into ui_text_overrides (key, value) values ('nav.news', 'Latest')");
  await as(null, async () => {
    assert.deepEqual(await q("select key, value from ui_text_overrides"), [
      { key: "nav.news", value: "Latest" },
    ]);
    await refused(q("select updated_by from ui_text_overrides"), /permission denied/);
    await refused(q("select updated_at from ui_text_overrides"), /permission denied/);
  });
  assert.equal(
    (await as(id.reader, () => q("select key, value from ui_text_overrides"))).length,
    1,
  );
});

test("ui texts: anon can't write at all", async () => {
  await as(null, async () => {
    await refused(
      q("insert into ui_text_overrides (key, value) values ('home.title', 'x')"),
      /permission denied/,
    );
    await refused(q("update ui_text_overrides set value = 'x'"), /permission denied/);
    await refused(q("delete from ui_text_overrides"), /permission denied/);
  });
});

test("ui texts: without the site right nothing changes; c alone adds but can't change or reset", async () => {
  for (const user of [id.observer, id.reader, id.viewer]) {
    await as(user, async () => {
      await refused(
        q("insert into ui_text_overrides (key, value) values ('home.intro', 'Hijacked')"),
        /row-level security/,
      );
      assert.equal(
        (await q("update ui_text_overrides set value = 'Hijacked' returning key")).length,
        0,
        `user ${user}`,
      );
      assert.equal(
        (await q("delete from ui_text_overrides returning key")).length,
        0,
        `user ${user}`,
      );
    });
  }
  assert.equal(await value("nav.news"), "Latest");

  await as(id.creator, async () => {
    await q("insert into ui_text_overrides (key, value) values ('nav.about', 'Who we are')");
    assert.equal(
      (await q("update ui_text_overrides set value = 'x' where key = 'nav.about' returning key"))
        .length,
      0,
    );
    assert.equal(
      (await q("delete from ui_text_overrides where key = 'nav.about' returning key")).length,
      0,
    );
  });
  assert.equal(await value("nav.about"), "Who we are");
  await q("delete from ui_text_overrides");
});

test("ui texts: who and when can't be forged", async () => {
  await as(id.editor, async () => {
    await refused(
      q("insert into ui_text_overrides (key, value, updated_by) values ('home.title', 'x', $1)", [
        id.admin,
      ]),
      /permission denied/,
    );
    await q("insert into ui_text_overrides (key, value) values ('home.title', 'x')");
    await refused(
      q("update ui_text_overrides set updated_at = now() - interval '1 year'"),
      /permission denied/,
    );
    await refused(q("update ui_text_overrides set key = 'nav.news'"), /permission denied/);
  });
  await q("delete from ui_text_overrides");
});

test("ui texts: the CHECKs refuse malformed keys and values", async () => {
  const insert = (key, text) =>
    as(id.editor, () =>
      q("insert into ui_text_overrides (key, value) values ($1, $2)", [key, text]),
    );
  for (const key of [
    "home",
    ".home.title",
    "home..title",
    "home.title.",
    "1home.title",
    "home/title",
    "home.<b>",
    `home.${"x".repeat(200)}`,
  ]) {
    await refused(insert(key, "x"), /check constraint/);
  }
  for (const text of ["", "   ", "<b>x</b>", "a < b", "x".repeat(2001)]) {
    await refused(insert("home.title", text), /check constraint/);
  }
  // Allowed shapes: array indexes, category names with spaces and "&", placeholders, 2000 chars.
  await insert("patrons.benefits.0.title", "Build the Atlas");
  await insert("categories.Politics & International Relations", "Politics");
  await insert("ui.newsMany", "{count} news items");
  await insert("home.intro", "x".repeat(2000));
  await q("delete from ui_text_overrides");
});
