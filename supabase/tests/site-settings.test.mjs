import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

/**
 * Site settings and social links (migration 20261013000110_site_settings):
 * everyone reads the settings row and the visible links, section `site`
 * decides every write, the CHECKs match the admin's Zod schema, and the seed
 * carries today's values so nothing changes on the site at deploy.
 *
 * Run: npm run test:db
 */

const here = dirname(fileURLToPath(import.meta.url));
const migrations = join(here, "..", "migrations");
const db = new PGlite();

const id = {
  admin: "00000000-0000-4000-8000-000000000d01",
  editor: "00000000-0000-4000-8000-000000000d02",
  observer: "00000000-0000-4000-8000-000000000d03",
  reader: "00000000-0000-4000-8000-000000000d04",
  viewer: "00000000-0000-4000-8000-000000000d05",
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

/** The columns the public site reads (features/site/queries.ts). */
const SETTINGS_COLUMNS = `name, alternate_names, legal_name, company_id, founding_date,
  street_address, postal_code, address_locality, address_country, description, wikidata_id,
  contact_email, seo_title, title_suffix, seo_description, og_image_url, copyright`;
const LINK_COLUMNS = "label, url, icon";

const links = () =>
  q(`select ${LINK_COLUMNS} from site_social_links order by position, created_at, id`);

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
// Seed: today's values, so the deploy changes nothing visible
// ---------------------------------------------------------------------------

test("site settings: seeded with the values the code used until now", async () => {
  const row = await as(null, () =>
    one(`select ${SETTINGS_COLUMNS}, founding_date::text as founded from site_settings`),
  );
  assert.equal(row.name, "Atlas of Today's World");
  assert.deepEqual(row.alternate_names, ["Atlas of Todays World", "ATW"]);
  assert.equal(row.legal_name, "Atlas of Today's World, z. s.");
  assert.equal(row.company_id, "05363454");
  assert.equal(row.founded, "2016-09-07");
  assert.equal(row.street_address, "náměstí Jana Palacha 1/2");
  assert.equal(row.postal_code, "110 00");
  assert.equal(row.address_locality, "Praha 1");
  assert.equal(row.address_country, "CZ");
  assert.equal(row.wikidata_id, "Q106194019");
  assert.equal(row.contact_email, "info@atlasoftodaysworld.org");
  assert.equal(row.seo_title, "Atlas of Today's World — interactive atlas of every country");
  assert.equal(row.title_suffix, "— Atlas of Today's World");
  assert.equal(row.og_image_url, "/og-image.png");
  assert.equal(row.copyright, "© Atlas of Today’s World");
  assert.match(row.description, /^Atlas of Today's World is a non-profit/);
  assert.match(row.seo_description, /^Explore every country and world region/);
});

test("social links: seeded in today's order", async () => {
  assert.deepEqual(
    (await as(null, links)).map((row) => [row.label, row.icon]),
    [
      ["Instagram", "IG"],
      ["LinkedIn", "in"],
      ["Facebook", "f"],
      ["Bluesky", "bs"],
    ],
  );
});

// ---------------------------------------------------------------------------
// Settings: read by everyone, changed with `site` "e" only
// ---------------------------------------------------------------------------

test("site settings: anon reads the public columns, nothing else, and can't write", async () => {
  await as(null, async () => {
    assert.equal((await q(`select ${SETTINGS_COLUMNS} from site_settings`)).length, 1);
    await refused(q("select updated_at from site_settings"), /permission denied/);
    await refused(q("update site_settings set name = 'X'"), /permission denied/);
    await refused(q("delete from site_settings"), /permission denied/);
  });
});

test("site settings: an editor with site 'e' saves; others change nothing", async () => {
  await as(id.editor, () =>
    q("update site_settings set copyright = '© Atlas', title_suffix = '| Atlas'"),
  );
  assert.equal((await one("select copyright from site_settings")).copyright, "© Atlas");

  for (const user of [id.observer, id.reader, id.viewer]) {
    const rows = await as(user, () =>
      q("update site_settings set copyright = 'Hijacked' returning id"),
    );
    assert.equal(rows.length, 0, `user ${user}`);
  }
  assert.equal((await one("select copyright from site_settings")).copyright, "© Atlas");

  const audit = await one(
    "select count(*)::int n from audit_log where action = 'site_settings.update' and target = '1'",
  );
  assert.ok(audit.n >= 1, "the change is in the audit log");
  await q(
    "update site_settings set copyright = '© Atlas of Today’s World', title_suffix = '— Atlas of Today''s World'",
  );
});

test("site settings: one row — nobody inserts or deletes, not even the admin", async () => {
  await as(id.admin, async () => {
    await refused(q("insert into site_settings (id) values (2)"), /permission denied/);
    await refused(q("delete from site_settings"), /permission denied/);
    // Columns outside the grant (the id, the stamp) can't be set either.
    await refused(q("update site_settings set id = 1"), /permission denied/);
  });
  await refused(
    q(`insert into site_settings (id, name, legal_name, company_id, founding_date, street_address,
         postal_code, address_locality, address_country, description, contact_email, seo_title,
         seo_description, og_image_url, copyright)
       values (2, 'x', 'x', '12345678', '2020-01-01', 'x', 'x', 'x', 'CZ', 'x', 'a@b.cz', 'x', 'x',
         '/x.png', 'x')`),
    /site_settings_id_check/,
  );
});

test("site settings: the CHECKs refuse malformed values", async () => {
  const bad = [
    ["company_id", "1234567"],
    ["company_id", "1234567a"],
    ["address_country", "cz"],
    ["contact_email", "nobody"],
    ["wikidata_id", "106194019"],
    ["og_image_url", "http://example.org/x.png"],
    ["og_image_url", "//evil.example/x.png"],
    ["og_image_url", "/\\evil.example/x.png"],
    ["og_image_url", "/og image.png"],
    ["og_image_url", "javascript:alert(1)"],
    ["og_image_url", `https://example.org/${"x".repeat(1000)}`],
    ["name", "   "],
    ["seo_title", "x".repeat(121)],
    ["seo_description", "x".repeat(301)],
    ["title_suffix", "x".repeat(81)],
    ["copyright", ""],
  ];
  await as(id.editor, async () => {
    for (const [column, value] of bad) {
      await refused(q(`update site_settings set ${column} = $1`, [value]), /check constraint/);
    }
    await refused(
      q("update site_settings set alternate_names = $1", [
        Array.from({ length: 11 }, (_, i) => `Name ${i}`),
      ]),
      /alternate_names/,
    );
    // Allowed shapes: an https URL or a path on this site; no Wikidata item.
    await q("update site_settings set og_image_url = 'https://cdn.example.org/og.png'");
    await q("update site_settings set og_image_url = '/og-image.png', wikidata_id = null");
    await q("update site_settings set wikidata_id = 'Q106194019'");
  });
});

// ---------------------------------------------------------------------------
// Social links
// ---------------------------------------------------------------------------

test("social links: anon reads only the visible ones and can't write", async () => {
  const hidden = await one(
    "insert into site_social_links (label, url, icon, position, visible) values ('Mastodon', 'https://mastodon.social/@atlas', 'M', 9, false) returning id",
  );
  await as(null, async () => {
    const rows = await links();
    assert.equal(rows.length, 4);
    assert.ok(!rows.some((row) => row.label === "Mastodon"));
    await refused(q("select updated_at from site_social_links"), /permission denied/);
    await refused(
      q("insert into site_social_links (label, url, icon) values ('X', 'https://x.example', 'X')"),
      /permission denied/,
    );
    await refused(q("delete from site_social_links"), /permission denied/);
    await refused(q("select move_site_social_link($1, true)", [hidden.id]), /permission denied/);
  });
  // The team with `site` "v" sees the hidden one too; other team members and readers don't.
  assert.equal((await as(id.viewer, links)).length, 5);
  assert.equal((await as(id.editor, links)).length, 5);
  assert.equal((await as(id.observer, links)).length, 4);
  assert.equal((await as(id.reader, links)).length, 4);
  await q("delete from site_social_links where id = $1", [hidden.id]);
});

test("social links: site c/e/d add, change and delete; without them nothing happens", async () => {
  const added = await as(id.editor, () =>
    one(
      "insert into site_social_links (label, url, icon, position) values ('YouTube', 'https://www.youtube.com/@atlas', 'YT', 4) returning id",
    ),
  );
  await as(id.editor, () =>
    q("update site_social_links set label = 'YouTube channel' where id = $1", [added.id]),
  );
  assert.equal(
    (await one("select label from site_social_links where id = $1", [added.id])).label,
    "YouTube channel",
  );

  for (const user of [id.observer, id.reader, id.viewer]) {
    await as(user, async () => {
      await refused(
        q(
          "insert into site_social_links (label, url, icon) values ('X', 'https://x.example/', 'X')",
        ),
        /row-level security/,
      );
      assert.equal(
        (await q("update site_social_links set label = 'Hijacked' returning id")).length,
        0,
        `user ${user}`,
      );
      assert.equal(
        (await q("delete from site_social_links where id = $1 returning id", [added.id])).length,
        0,
        `user ${user}`,
      );
    });
  }

  const actions = (
    await q("select action from audit_log where target = $1 order by id", [added.id])
  ).map((row) => row.action);
  assert.deepEqual(actions, ["site_social_links.insert", "site_social_links.update"]);

  await as(id.editor, () => q("delete from site_social_links where id = $1", [added.id]));
  assert.equal((await as(id.editor, links)).length, 4);
});

test("social links: the CHECKs match the admin form", async () => {
  const insert = (label, url, icon) =>
    as(id.editor, () =>
      q("insert into site_social_links (label, url, icon) values ($1, $2, $3)", [label, url, icon]),
    );
  await refused(insert("X", "http://x.example/", "X"), /check constraint/);
  await refused(insert("X", "javascript:alert(1)", "X"), /check constraint/);
  await refused(insert("X", "https://x.example/", "ABCD"), /check constraint/);
  await refused(insert("X", "https://x.example/", "a b"), /check constraint/);
  await refused(insert(" ", "https://x.example/", "X"), /check constraint/);
  await refused(insert("x".repeat(61), "https://x.example/", "X"), /check constraint/);
  // One link per address.
  await refused(
    insert("Again", "https://www.facebook.com/atlasoftodaysworld/", "f"),
    /duplicate key|unique/,
  );
});

test("social links: move swaps neighbours in one step, only with site 'e'", async () => {
  const order = async () => (await links()).map((row) => row.label);
  const facebook = await one("select id from site_social_links where label = 'Facebook'");

  await as(id.editor, () => q("select move_site_social_link($1, true)", [facebook.id]));
  assert.deepEqual(await order(), ["Instagram", "Facebook", "LinkedIn", "Bluesky"]);

  await as(id.editor, () => q("select move_site_social_link($1, false)", [facebook.id]));
  assert.deepEqual(await order(), ["Instagram", "LinkedIn", "Facebook", "Bluesky"]);

  // At the ends nothing moves.
  const instagram = await one("select id from site_social_links where label = 'Instagram'");
  await as(id.editor, () => q("select move_site_social_link($1, true)", [instagram.id]));
  assert.deepEqual(await order(), ["Instagram", "LinkedIn", "Facebook", "Bluesky"]);

  for (const user of [id.observer, id.reader, id.viewer]) {
    await as(user, () =>
      refused(
        q("select move_site_social_link($1, true)", [facebook.id]),
        /can't reorder social links/,
      ),
    );
  }
  await as(id.editor, () =>
    refused(
      q("select move_site_social_link('00000000-0000-4000-8000-0000000000ff', true)"),
      /no longer exists/,
    ),
  );
  assert.deepEqual(await order(), ["Instagram", "LinkedIn", "Facebook", "Bluesky"]);
});
