import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

/**
 * CHECKs matching the admin forms' limits (migration
 * 20261013000105_check_limits_match_forms): each column takes a value at the
 * form's limit and refuses one character more.
 *
 * The harness stops before that migration, loads the seed plus a few fixtures
 * (one of them a resource whose URL is over the new cap), then applies the
 * rest — so validating the constraints is tried on real seed data, and the
 * constraints left NOT VALID are shown not to break on old rows.
 *
 * Run: npm run test:db
 */

const here = dirname(fileURLToPath(import.meta.url));
const migrations = join(here, "..", "migrations");
const FIRST_NEW = "20261013000105";
const db = new PGlite();

const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const one = async (sql, params = []) => (await q(sql, params))[0];

const LONG_URL = `https://example.org/${"a".repeat(1100)}`;

before(async () => {
  await db.exec(readFileSync(join(here, "supabase-stubs.sql"), "utf8"));
  const files = readdirSync(migrations)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const apply = async (list) => {
    for (const file of list) {
      try {
        await db.exec(readFileSync(join(migrations, file), "utf8"));
      } catch (error) {
        throw new Error(`${file}: ${error.message}`);
      }
    }
  };
  await apply(files.filter((f) => f < FIRST_NEW));
  await db.exec(readFileSync(join(here, "..", "seed.sql"), "utf8"));

  // Rows the seed doesn't have, and an imported link longer than the new cap.
  await db.exec(`
    insert into authors (name, slug) values ('Limit Author', 'limit-author');
    insert into invitations (email, role_id) values ('limits@example.org', 'reader');
    insert into map_areas (slug, name, fill, stroke, geometry) values
      ('limit-area', 'Limit area', '#aabbcc', '#112233',
       '{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,0]]]}');
    insert into resources (region_slug, kind, position, title, url)
      select slug, 'Educational Resources', 99, 'Long imported link', '${LONG_URL}'
      from regions order by slug limit 1;
  `);

  await apply(files.filter((f) => f >= FIRST_NEW));
});

/** The first row of a table, as a WHERE clause on its ctid. */
const firstRow = (table) => `ctid = (select ctid from ${table} order by ctid limit 1)`;

/** Updates one column of one row; resolves to the violated constraint, or null. */
async function violation(table, set, where, params) {
  try {
    await db.query(`update ${table} set ${set} where ${where}`, params);
    return null;
  } catch (error) {
    return error.constraint ?? error.message;
  }
}

const text = (length) => "x".repeat(length);
const url = (length) => `https://example.org/${"u".repeat(length - "https://example.org/".length)}`;

/** [table, column, limit, value of a given length, row (default: the first one)] */
const LENGTHS = [
  ["timeline_events", "date_label", 60, text],
  ["timeline_events", "title", 200, text],
  ["timeline_events", "body", 2000, text],
  ["timeline_events", "image_url", 1000, url],
  ["faq_items", "question", 300, text],
  ["faq_items", "answer", 3000, text],
  // Not the imported over-long link (the last test): every write of it fails.
  ["resources", "title", 200, text, "length(url) <= 1000"],
  ["resources", "source", 120, text, "length(url) <= 1000"],
  ["resources", "description", 600, text, "length(url) <= 1000"],
  ["resources", "url", 1000, url, "length(url) <= 1000"],
  ["resources", "image_url", 1000, url, "length(url) <= 1000"],
  ["visual_embeds", "title", 200, text],
  ["visual_embeds", "caption", 500, text],
  ["visual_embeds", "url", 1000, url, "provider <> 'datawrapper'"],
  ["portrait_metrics", "source_url", 1000, url],
  ["regions", "name", 120, text],
  ["regions", "tagline", 200, text],
  ["regions", "summary", 1000, text],
  ["regions", "intro", 5000, text],
  ["regions", "timeline_title", 120, text],
  ["regions", "timeline_subtitle", 300, text],
  ["regions", "hero_url", 1000, url],
  ["special_regions", "subtitle", 200, text],
  ["special_regions", "summary", 1000, text],
  ["special_regions", "intro", 5000, text],
  ["special_regions", "timeline_title", 120, text],
  ["special_regions", "timeline_subtitle", 300, text],
  ["special_regions", "hero_url", 1000, url],
  ["countries", "blurb", 1000, text],
  ["indicators", "short_label", 60, text],
  ["indicators", "source", 200, text],
  ["indicators", "source_url", 1000, url],
  ["map_areas", "label", 60, text],
  ["authors", "photo_url", 1000, url],
];

for (const [table, column, limit, value, where] of LENGTHS) {
  test(`${table}.${column}: at most ${limit} characters, like the form`, async () => {
    const row = where
      ? `ctid = (select ctid from ${table} where ${where} limit 1)`
      : firstRow(table);
    assert.ok(await one(`select 1 from ${table} where ${row}`), `a ${table} row to test on`);
    assert.equal(
      await violation(table, `${column} = $1`, row, [value(limit)]),
      null,
      "the limit itself fits",
    );
    assert.ok(
      [`${table}_${column}_len`, `${table}_${column}_check`].includes(
        await violation(table, `${column} = $1`, row, [value(limit + 1)]),
      ),
      "one character more is refused",
    );
  });
}

test("regions.name: not blank", async () => {
  assert.equal(
    await violation("regions", "name = '   '", firstRow("regions")),
    "regions_name_check",
  );
});

test("special_regions: map centre and zoom within the form's ranges", async () => {
  const row = firstRow("special_regions");
  for (const set of [
    "center_lon = -180",
    "center_lon = 180",
    "center_lat = -90",
    "center_lat = 90",
    "zoom = 0.5",
    "zoom = 9",
  ]) {
    assert.equal(await violation("special_regions", set, row), null, set);
  }
  for (const [set, constraint] of [
    ["center_lon = 180.01", "special_regions_center_lon_check"],
    ["center_lon = -181", "special_regions_center_lon_check"],
    ["center_lat = 90.5", "special_regions_center_lat_check"],
    ["center_lat = -91", "special_regions_center_lat_check"],
    ["zoom = 0.4", "special_regions_zoom_check"],
    ["zoom = 9.1", "special_regions_zoom_check"],
  ]) {
    assert.equal(await violation("special_regions", set, row), constraint, set);
  }
});

test("indicators.ramp: at most 9 colours, each #rrggbb", async () => {
  const row = firstRow("indicators");
  const ok = ["{}", "{#aabbcc}", `{${Array(9).fill("#A1b2C3").join(",")}}`];
  for (const value of ok) {
    assert.equal(await violation("indicators", "ramp = $1", row, [value]), null, value);
  }
  const bad = [
    `{${Array(10).fill("#aabbcc").join(",")}}`,
    "{#abc}",
    "{aabbcc1}",
    "{#aabbcg}",
    '{"#aabbcc,#ddeeff"}',
    "{#aabbcc,NULL}",
    '{""}',
  ];
  for (const value of bad) {
    assert.equal(
      await violation("indicators", "ramp = $1", row, [value]),
      "indicators_ramp_check",
      value,
    );
  }
});

test("indicator_values.year: 1800 to 2100 or none, like the form", async () => {
  const row = firstRow("indicator_values");
  for (const year of [1800, 2100, null]) {
    assert.equal(await violation("indicator_values", "year = $1", row, [year]), null, `${year}`);
  }
  for (const year of [1799, 2101]) {
    assert.equal(
      await violation("indicator_values", "year = $1", row, [year]),
      "indicator_values_year_check",
      `${year}`,
    );
  }
});

test("invitations.email: at most 254 characters", async () => {
  const row = firstRow("invitations");
  const email = (length) => `${"a".repeat(length - "@example.org".length)}@example.org`;
  assert.equal(await violation("invitations", "email = $1", row, [email(254)]), null);
  assert.equal(
    await violation("invitations", "email = $1", row, [email(255)]),
    "invitations_email_len",
  );
});

test("security_settings.require_2fa_roles: at most 20 role ids of up to 40 characters", async () => {
  const row = "id = 1";
  const ids = (count, length) =>
    `{${Array.from({ length: count }, (_, i) => `${i}`.padEnd(length, "r")).join(",")}}`;
  assert.equal(
    await violation("security_settings", "require_2fa_roles = $1", row, [ids(20, 40)]),
    null,
  );
  for (const value of [ids(21, 10), ids(1, 41)]) {
    assert.equal(
      await violation("security_settings", "require_2fa_roles = $1", row, [value]),
      "security_settings_require_2fa_roles_check",
    );
  }
});

test("validated where the data is known to fit; URL caps over imported links stay NOT VALID", async () => {
  const sql = readFileSync(join(migrations, `${FIRST_NEW}_check_limits_match_forms.sql`), "utf8");
  const names = [...sql.matchAll(/add constraint (\w+)/g)].map((match) => match[1]);
  assert.equal(names.length, 41);
  const rows = await q(
    `select conname, convalidated from pg_constraint
     where connamespace = 'public'::regnamespace and contype = 'c' and conname = any($1)`,
    [names],
  );
  assert.equal(rows.length, names.length, "every constraint of the migration exists");
  assert.deepEqual(
    rows
      .filter((row) => !row.convalidated)
      .map((row) => row.conname)
      .sort(),
    [
      "portrait_metrics_source_url_len",
      "regions_hero_url_len",
      "resources_image_url_len",
      "resources_url_len",
      "timeline_events_image_url_len",
    ],
  );
});

test("a NOT VALID cap keeps an old over-long link; writing the row again is checked", async () => {
  const row = await one("select id, length(url) as length from resources where url = $1", [
    LONG_URL,
  ]);
  assert.ok(row && row.length > 1000, "the imported link survived the migration");
  // Postgres checks the whole new row on an update, so even another column
  // can't change until the link is shortened (the form rejects it anyway)…
  assert.equal(
    await violation("resources", "title = 'Renamed'", `id = '${row.id}'`),
    "resources_url_len",
  );
  // …and a fixed link saves.
  assert.equal(
    await violation("resources", "url = $1", `id = '${row.id}'`, ["https://example.org/ok"]),
    null,
  );
});
