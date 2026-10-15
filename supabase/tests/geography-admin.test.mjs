import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

/**
 * Geography in the admin (migration 20261013000300_geography_admin_fields):
 * the CHECKs of the new region / country form fields (validated against the
 * seed), reordering regions and data layers through move_region /
 * move_indicator (rights: regions "e" / layers "e"), a layer's latest year
 * following the values entered by hand, the audit of changed facts and the
 * map area note kept from anon.
 *
 * The harness loads the seed before this migration, so validating its
 * constraints is tried on the real seed data.
 *
 * Run: npm run test:db
 */

const here = dirname(fileURLToPath(import.meta.url));
const migrations = join(here, "..", "migrations");
const FIRST_NEW = "20261013000300";
const db = new PGlite();

const id = {
  admin: "00000000-0000-4000-8000-000000000e01",
  dataEditor: "00000000-0000-4000-8000-000000000e02",
  editor: "00000000-0000-4000-8000-000000000e03",
  regionsOnly: "00000000-0000-4000-8000-000000000e04",
  reader: "00000000-0000-4000-8000-000000000e05",
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

/** One write under the service key, undone afterwards (CHECK tests). */
async function rolledBack(sql) {
  await q("begin");
  try {
    return await q(sql);
  } finally {
    await q("rollback");
  }
}

const regionOrder = async () =>
  (await q("select slug from regions order by position, slug")).map((row) => row.slug);
const layerOrder = async () =>
  (await q("select id from indicators order by position, id")).map((row) => row.id);
const latestYear = async (layer) =>
  (await one("select latest_year from indicators where id = $1", [layer])).latest_year;

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
  await db.exec(`
    insert into map_areas (slug, name, note, fill, stroke, geometry) values
      ('test-area', 'Test area', 'Shape traced from the UN map', '#aabbcc', '#112233',
       '{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,0]]]}');
    -- An editor's tagline that only differs in case from the boilerplate stays.
    update regions set tagline = 'A comprehensive portrait with global perspective'
     where slug = 'east-asia';
  `);
  await apply(files.filter((f) => f >= FIRST_NEW));

  // A role that edits regions and countries but not the data layers' definitions.
  await db.exec(`
    insert into roles (id, name) values ('regions-only', 'Regions only');
    insert into role_permissions (role_id, section, actions) values ('regions-only', 'regions', 've');
  `);
  const people = [
    [id.admin, "admin", "staff"],
    [id.dataEditor, "data-editor", "staff"],
    [id.editor, "content-editor", "staff"],
    [id.regionsOnly, "regions-only", "staff"],
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
test("geography admin: the test roles hold the rights the tests assume", async () => {
  const has = (user, section, action) =>
    as(user, async () => (await one("select has_perm($1, $2) as ok", [section, action])).ok);
  assert.equal(await has(id.dataEditor, "regions", "e"), true);
  assert.equal(await has(id.dataEditor, "layers", "e"), true);
  assert.equal(await has(id.editor, "regions", "e"), false);
  assert.equal(await has(id.editor, "layers", "e"), false);
  assert.equal(await has(id.regionsOnly, "regions", "e"), true);
  assert.equal(await has(id.regionsOnly, "layers", "e"), false);
});

test("regions: the old site's boilerplate tagline is cleared, real ones stay", async () => {
  const taglines = Object.fromEntries(
    (await q("select slug, tagline from regions")).map((row) => [row.slug, row.tagline]),
  );
  assert.equal(
    Object.values(taglines).filter(
      (tagline) => tagline === "A Comprehensive Portrait with global perspective",
    ).length,
    0,
  );
  // The seed's other regions had exactly the boilerplate.
  assert.equal(taglines["middle-east-north-africa"], "");
  assert.equal(taglines["latin-america-caribbean"], "");
  // Not an exact match (case) and a real tagline: untouched.
  assert.equal(taglines["east-asia"], "A comprehensive portrait with global perspective");
  assert.equal(taglines.antarctica, "The frozen continent");
});

// ---------------------------------------------------------------------------
// CHECKs
// ---------------------------------------------------------------------------

test("geography admin: the new constraints are validated on the seed data", async () => {
  const rows = await q(
    `select conname, convalidated from pg_constraint
      where conname in ('regions_zoom_check', 'countries_name_check', 'countries_name_formal_len',
                        'countries_un_subregion_len', 'countries_territory_note_len',
                        'countries_population_max')`,
  );
  assert.equal(rows.length, 6);
  for (const row of rows) assert.equal(row.convalidated, true, row.conname);
});

test("regions: centre and zoom within the form's ranges", async () => {
  for (const [set, check] of [
    ["zoom = 0.4", /regions_zoom_check/],
    ["zoom = 9.1", /regions_zoom_check/],
    ["center_lon = 180.5", /regions_center_lon_check/],
    ["center_lat = -90.5", /regions_center_lat_check/],
  ]) {
    await refused(rolledBack(`update regions set ${set} where slug = 'antarctica'`), check);
  }
  const ok = await rolledBack(
    "update regions set zoom = 9, center_lon = -180, center_lat = 90 where slug = 'antarctica' returning slug",
  );
  assert.equal(ok.length, 1);
});

test("countries: name, formal name, subregion, status note and population like the form", async () => {
  const at = (n) => `'${"a".repeat(n)}'`;
  for (const [set, check] of [
    ["name = '  '", /countries_name_check/],
    [`name = ${at(121)}`, /countries_name_check/],
    [`name_formal = ${at(201)}`, /countries_name_formal_len/],
    [`un_subregion = ${at(61)}`, /countries_un_subregion_len/],
    [`territory_note = ${at(1001)}`, /countries_territory_note_len/],
    ["population = -1", /countries_population_check/],
    ["population = 20000000001", /countries_population_max/],
  ]) {
    await refused(rolledBack(`update countries set ${set} where iso3 = 'XKX'`), check);
  }
  const ok = await rolledBack(
    `update countries set name = ${at(120)}, name_formal = ${at(200)}, un_subregion = ${at(60)},
       territory_note = ${at(1000)}, population = 20000000000 where iso3 = 'XKX' returning iso3`,
  );
  assert.equal(ok.length, 1);
  // Optional facts may be left empty.
  const cleared = await rolledBack(
    `update countries set name_formal = null, un_subregion = null, territory_note = null,
       population = null where iso3 = 'XKX' returning iso3`,
  );
  assert.equal(cleared.length, 1);
});

// ---------------------------------------------------------------------------
// Writing the facts (RLS as before: regions "e")
// ---------------------------------------------------------------------------

test("countries: regions 'e' changes the facts; others can't, and the change is audited", async () => {
  for (const user of [id.editor, id.reader]) {
    const rows = await as(user, () =>
      q("update countries set population = 1 where iso3 = 'XKX' returning iso3"),
    );
    assert.equal(rows.length, 0, `user ${user}`);
  }
  await refused(
    as(null, () => q("update countries set population = 1 where iso3 = 'XKX'")),
    /permission denied/,
  );

  const rows = await as(id.regionsOnly, () =>
    q(
      `update countries set name = 'Kosova', name_formal = 'Republic of Kosovo', population = 1800000,
         un_subregion = 'Southern Europe', territory_note = 'Status note.'
       where iso3 = 'XKX' returning iso3`,
    ),
  );
  assert.equal(rows.length, 1);
  const audit = await one(
    "select actor, target, detail from audit_log where action = 'countries.update' order by id desc limit 1",
  );
  assert.equal(audit.actor, id.regionsOnly);
  assert.equal(audit.target, "XKX");
  assert.equal(audit.detail.new.population, 1800000);
  assert.equal(audit.detail.new.name, "Kosova");

  // A text-only save (profile) is not logged as a change of facts.
  const before = (await one("select count(*)::int as n from audit_log")).n;
  await as(id.regionsOnly, () =>
    q("update countries set tagline = 'A young state' where iso3 = 'XKX'"),
  );
  assert.equal((await one("select count(*)::int as n from audit_log")).n, before);
});

test("regions: centre and zoom are saved by regions 'e' and audited", async () => {
  const rows = await as(id.regionsOnly, () =>
    q(
      "update regions set center_lon = 1, center_lat = -80, zoom = 1.8 where slug = 'antarctica' returning slug",
    ),
  );
  assert.equal(rows.length, 1);
  const audit = await one(
    "select actor, target, detail from audit_log where action = 'regions.update' order by id desc limit 1",
  );
  assert.equal(audit.actor, id.regionsOnly);
  assert.equal(audit.target, "antarctica");
  assert.equal(Number(audit.detail.new.zoom), 1.8);
  const denied = await as(id.editor, () =>
    q("update regions set zoom = 3 where slug = 'antarctica' returning slug"),
  );
  assert.equal(denied.length, 0);
});

// ---------------------------------------------------------------------------
// Order of regions and data layers
// ---------------------------------------------------------------------------

test("move_region: regions 'e' moves a region; the list is renumbered in one step", async () => {
  const start = await regionOrder();
  assert.equal(start.at(-1), "antarctica");
  await as(id.regionsOnly, () => q("select move_region('antarctica', true)"));
  const moved = await regionOrder();
  assert.deepEqual(moved, [...start.slice(0, -2), "antarctica", start.at(-2)]);
  assert.deepEqual(
    (await q("select position from regions order by position")).map((row) => row.position),
    moved.map((_, index) => (index + 1) * 10),
  );
  // First up / last down change nothing and are no error.
  await as(id.dataEditor, () => q("select move_region($1, true)", [moved[0]]));
  await as(id.dataEditor, () => q("select move_region($1, false)", [moved.at(-1)]));
  assert.deepEqual(await regionOrder(), moved);
  await as(id.dataEditor, () => q("select move_region('antarctica', false)"));
  assert.deepEqual(await regionOrder(), start);
});

test("move_region: refused without regions 'e', for anon and for an unknown region", async () => {
  const start = await regionOrder();
  for (const user of [id.editor, id.reader]) {
    await refused(
      as(user, () => q("select move_region('antarctica', true)")),
      /can't reorder the regions/,
    );
  }
  await refused(
    as(null, () => q("select move_region('antarctica', true)")),
    /permission denied for function/,
  );
  await refused(
    as(id.dataEditor, () => q("select move_region('atlantis', true)")),
    /no longer exists/,
  );
  assert.deepEqual(await regionOrder(), start);
});

test("move_indicator: layers 'e' moves a layer; regions-only, readers and anon can't", async () => {
  const start = await layerOrder();
  await as(id.dataEditor, () => q("select move_indicator($1, false)", [start[0]]));
  assert.deepEqual(await layerOrder(), [start[1], start[0], ...start.slice(2)]);
  for (const user of [id.regionsOnly, id.editor, id.reader]) {
    await refused(
      as(user, () => q("select move_indicator($1, true)", [start[0]])),
      /can't reorder the data layers/,
    );
  }
  await refused(
    as(null, () => q("select move_indicator($1, true)", [start[0]])),
    /permission denied for function/,
  );
  await as(id.admin, () => q("select move_indicator($1, true)", [start[0]]));
  assert.deepEqual(await layerOrder(), start);
});

// ---------------------------------------------------------------------------
// Latest year of a layer
// ---------------------------------------------------------------------------

test("latest_year follows the values entered by hand (also by a regions-only editor)", async () => {
  assert.equal(await latestYear("hdi"), 2023);
  await as(id.regionsOnly, () =>
    q(
      "insert into indicator_values (indicator_id, country_iso3, value, year, source_note) values ('hdi', 'XKX', 0.8, 2025, 'UNDP HDR 2026')",
    ),
  );
  assert.equal(await latestYear("hdi"), 2025);

  // Dropping its year: the newest is the imported 2023 again.
  await as(id.dataEditor, () =>
    q(
      "update indicator_values set year = null where indicator_id = 'hdi' and country_iso3 = 'XKX'",
    ),
  );
  assert.equal(await latestYear("hdi"), 2023);

  await as(id.dataEditor, () =>
    q(
      "update indicator_values set year = 2024 where indicator_id = 'hdi' and country_iso3 = 'XKX'",
    ),
  );
  assert.equal(await latestYear("hdi"), 2024);
  await as(id.admin, () =>
    q("delete from indicator_values where indicator_id = 'hdi' and country_iso3 = 'XKX'"),
  );
  assert.equal(await latestYear("hdi"), 2023);
});

test("latest_year: a layer whose values have no year keeps its own; imports are left alone", async () => {
  await as(id.dataEditor, () =>
    q(
      `insert into indicators (id, label, domain_min, domain_max, is_custom, latest_year)
       values ('test-layer', 'Test layer', 0, 1, true, 2020)`,
    ),
  );
  await as(id.dataEditor, () =>
    q(
      "insert into indicator_values (indicator_id, country_iso3, value, source_note) values ('test-layer', 'XKX', 0.5, 'Own survey')",
    ),
  );
  assert.equal(await latestYear("test-layer"), 2020);

  // The service key (import) writes values and the latest year itself.
  await q(
    "insert into indicator_values (indicator_id, country_iso3, value, year) values ('test-layer', 'ALB', 0.4, 2030)",
  );
  assert.equal(await latestYear("test-layer"), 2020);
  await q("delete from indicators where id = 'test-layer'");
});

test("latest_year: the trigger function is not callable", async () => {
  await refused(
    as(id.admin, () => q("select refresh_indicator_latest_year()")),
    /permission denied|trigger functions can only be called as triggers/,
  );
});

// ---------------------------------------------------------------------------
// Map area note
// ---------------------------------------------------------------------------

test("map_areas.note: anon can't read it, the public columns stay; the team reads it", async () => {
  await refused(
    as(null, () => q("select note from map_areas")),
    /permission denied/,
  );
  const rows = await as(null, () =>
    q("select slug, name, label, country_iso3, fill, stroke, geometry from map_areas"),
  );
  assert.equal(rows.length, 1);
  const team = await as(id.admin, () => q("select note from map_areas where slug = 'test-area'"));
  assert.equal(team[0].note, "Shape traced from the UN map");
});
