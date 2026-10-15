import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

/**
 * Site menus (migration 20261013000270_navigation_items): everyone reads the
 * visible items, section `site` decides every write, the CHECKs refuse links
 * that could leave the site unsafely (`//host`, `javascript:`), and the seed
 * carries today's items so nothing changes on the site at deploy.
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

/** The columns the public site reads (features/navigation/queries.ts). */
const PUBLIC_COLUMNS = "id, menu, label, href, is_primary, compact_hidden, requires_flag";

const items = (menu) =>
  q(`select ${PUBLIC_COLUMNS} from nav_items where menu = $1 order by position, created_at, id`, [
    menu,
  ]);
const labels = async (menu) => (await items(menu)).map((row) => row.label);

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
  // A custom role that may only look at site content.
  await db.exec(`
    insert into roles (id, name, news_scope) values ('site-viewer', 'Site viewer', 'own');
    insert into role_permissions (role_id, section, actions) values ('site-viewer', 'site', 'v');
  `);
  const people = [
    [id.admin, "admin", "staff"],
    [id.editor, "content-editor", "staff"],
    [id.observer, "observer", "staff"],
    [id.reader, "reader", "reader"],
    [id.viewer, "site-viewer", "staff"],
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
// Seed: today's items, so the deploy changes nothing visible
// ---------------------------------------------------------------------------

test("nav items: the main menu is seeded with today's items, labels and styles", async () => {
  // As readers see it: "Support the Atlas" is hidden since 20261015000030 (it
  // duplicated the "Atlas Patrons" button), still in the table for the admin.
  const rows = await as(null, () => items("main"));
  assert.deepEqual(
    rows.map((row) => [row.label, row.href, row.is_primary, row.compact_hidden, row.requires_flag]),
    [
      ["Topics", "/topics", false, false, null],
      ["Countries", "/countries", false, true, null],
      ["News", "/news", false, true, "news_menu"],
      ["About", "/about", false, false, null],
      ["Atlas Patrons", "/membership", true, false, null],
    ],
  );
  assert.deepEqual(await one("select visible from nav_items where label = 'Support the Atlas'"), {
    visible: false,
  });
});

test("nav items: the legal links are seeded in today's order", async () => {
  const rows = await as(null, () => items("legal"));
  assert.deepEqual(
    rows.map((row) => [row.label, row.href]),
    [
      ["Privacy", "/privacy"],
      ["Terms", "/terms"],
      ["Accessibility", "/accessibility"],
    ],
  );
});

// ---------------------------------------------------------------------------
// Rights
// ---------------------------------------------------------------------------

test("nav items: anon reads only visible items and the public columns, and can't write", async () => {
  const hidden = await one(
    "insert into nav_items (menu, label, href, position, visible) values ('main', 'Draft', '/draft', 9, false) returning id",
  );
  await as(null, async () => {
    assert.deepEqual(await labels("main"), [
      "Topics",
      "Countries",
      "News",
      "About",
      "Atlas Patrons",
    ]);
    await refused(q("select updated_at from nav_items"), /permission denied/);
    await refused(
      q("insert into nav_items (menu, label, href) values ('main', 'X', '/x')"),
      /permission denied/,
    );
    await refused(q("update nav_items set label = 'X'"), /permission denied/);
    await refused(q("delete from nav_items"), /permission denied/);
    await refused(q("select move_nav_item($1, true)", [hidden.id]), /permission denied/);
  });
  // The team with `site` "v" sees the hidden one too; other team members and readers don't.
  assert.equal((await as(id.viewer, () => items("main"))).length, 7);
  assert.equal((await as(id.editor, () => items("main"))).length, 7);
  assert.equal((await as(id.observer, () => items("main"))).length, 5);
  assert.equal((await as(id.reader, () => items("main"))).length, 5);
  await q("delete from nav_items where id = $1", [hidden.id]);
});

test("nav items: site c/e/d add, change and delete; without them nothing happens", async () => {
  const added = await as(id.editor, () =>
    one(
      "insert into nav_items (menu, label, href, position) values ('legal', 'Cookies', '/cookies', 3) returning id",
    ),
  );
  await as(id.editor, () =>
    q("update nav_items set label = 'Cookie policy', visible = false where id = $1", [added.id]),
  );
  assert.deepEqual(await one("select label, visible from nav_items where id = $1", [added.id]), {
    label: "Cookie policy",
    visible: false,
  });

  for (const user of [id.observer, id.reader, id.viewer]) {
    await as(user, async () => {
      await refused(
        q("insert into nav_items (menu, label, href) values ('main', 'X', '/x')"),
        /row-level security/,
      );
      assert.equal(
        (await q("update nav_items set label = 'Hijacked' returning id")).length,
        0,
        `user ${user}`,
      );
      assert.equal(
        (await q("delete from nav_items where id = $1 returning id", [added.id])).length,
        0,
        `user ${user}`,
      );
    });
  }

  // The menu of an existing item is fixed (no update grant on it), even for the admin.
  await as(id.admin, () =>
    refused(q("update nav_items set menu = 'main' where id = $1", [added.id]), /permission denied/),
  );

  const actions = (
    await q("select action from audit_log where target = $1 order by id", [added.id])
  ).map((row) => row.action);
  assert.deepEqual(actions, ["nav_items.insert", "nav_items.update"]);

  await as(id.editor, () => q("delete from nav_items where id = $1", [added.id]));
  assert.equal((await as(id.editor, () => items("legal"))).length, 3);
});

// ---------------------------------------------------------------------------
// CHECKs
// ---------------------------------------------------------------------------

test("nav items: the href CHECK refuses anything but a site path or https://", async () => {
  const insert = (href) =>
    as(id.editor, () =>
      q("insert into nav_items (menu, label, href) values ('main', 'X', $1)", [href]),
    );
  for (const href of [
    "//evil.example",
    "//evil.example/path",
    "/\\evil.example",
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "data:text/html,hi",
    "http://example.org/",
    "https://",
    "https:///path",
    "mailto:info@example.org",
    "about",
    "",
    "/About",
    "/with space",
    `/${"x".repeat(500)}`,
  ]) {
    await refused(insert(href), /check constraint/);
  }
  // Allowed shapes: a path on this site (with a query or anchor) or https://.
  const ok = [
    "/",
    "/news",
    "/view/hdi#hun",
    "/search?q=water",
    "https://example.org/",
    "https://shop.example.org/atlas?x=1",
  ];
  for (const href of ok) await insert(href);
  await q("delete from nav_items where label = 'X'");
});

test("nav items: label, menu, flag and style CHECKs", async () => {
  const insert = (menu, label, extra = {}) =>
    as(id.editor, () =>
      q(
        `insert into nav_items (menu, label, href, is_primary, compact_hidden, requires_flag)
         values ($1, $2, '/x', $3, $4, $5)`,
        [
          menu,
          label,
          extra.is_primary ?? false,
          extra.compact_hidden ?? false,
          extra.requires_flag ?? null,
        ],
      ),
    );
  await refused(insert("account", "X"), /check constraint/);
  await refused(insert("main", "   "), /check constraint/);
  await refused(insert("main", "x".repeat(61)), /check constraint/);
  await refused(insert("main", "X", { requires_flag: "maintenance" }), /check constraint/);
  await refused(insert("legal", "X", { is_primary: true }), /nav_items_main_only_styles/);
  await refused(insert("legal", "X", { compact_hidden: true }), /nav_items_main_only_styles/);
  await as(id.editor, () =>
    refused(q("update nav_items set position = 1001 where label = 'Topics'"), /check constraint/),
  );
  // Allowed: a flag on a legal link, the pill in the main menu.
  await insert("legal", "Y", { requires_flag: "newsletter" });
  await insert("main", "Y", { is_primary: true, compact_hidden: true });
  await q("delete from nav_items where label = 'Y'");
});

// ---------------------------------------------------------------------------
// Reordering
// ---------------------------------------------------------------------------

test("nav items: move swaps neighbours within one menu, only with site 'e'", async () => {
  const about = await one("select id from nav_items where label = 'About'");
  const privacy = await one("select id from nav_items where label = 'Privacy'");

  await as(id.editor, () => q("select move_nav_item($1, true)", [about.id]));
  assert.deepEqual(await labels("main"), [
    "Topics",
    "Countries",
    "About",
    "News",
    "Support the Atlas",
    "Atlas Patrons",
  ]);
  // The other menu is untouched.
  assert.deepEqual(await labels("legal"), ["Privacy", "Terms", "Accessibility"]);

  await as(id.editor, () => q("select move_nav_item($1, false)", [about.id]));
  assert.deepEqual((await labels("main")).slice(2, 4), ["News", "About"]);

  // At the ends nothing moves (the first legal link doesn't jump into the main menu).
  await as(id.editor, () => q("select move_nav_item($1, true)", [privacy.id]));
  assert.deepEqual(await labels("legal"), ["Privacy", "Terms", "Accessibility"]);

  for (const user of [id.observer, id.reader, id.viewer]) {
    await as(user, () =>
      refused(q("select move_nav_item($1, true)", [about.id]), /can't reorder menu items/),
    );
  }
  await as(id.editor, () =>
    refused(
      q("select move_nav_item('00000000-0000-4000-8000-0000000000ff', true)"),
      /no longer exists/,
    ),
  );
  assert.deepEqual((await labels("main")).slice(2, 4), ["News", "About"]);
});
