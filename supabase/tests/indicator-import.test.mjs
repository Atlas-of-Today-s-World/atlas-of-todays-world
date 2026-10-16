import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

/**
 * CSV import of a data layer's values (migration
 * 20261016000020_import_indicator_values): who may call
 * import_indicator_values() (layers / regions "e"; removing values in
 * "replace" mode needs layers "d"), what "replace" and "update only" do,
 * that rows are stored as manual values with the import's source, that rows
 * already the same are left alone, the limits, the categorical code check,
 * and that a refused import changes nothing.
 *
 * Run: npm run test:db
 */

const here = dirname(fileURLToPath(import.meta.url));
const migrations = join(here, "..", "migrations");
const db = new PGlite();

const id = {
  admin: "00000000-0000-4000-8000-000000003c01",
  dataEditor: "00000000-0000-4000-8000-000000003c02",
  editor: "00000000-0000-4000-8000-000000003c03",
  reader: "00000000-0000-4000-8000-000000003c04",
};

const LAYER = "import-test";
const CATEGORIES = "import-regime";

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

/** import_indicator_values() as `user`; returns its counts. */
const importAs = async (
  user,
  rows,
  { replace = false, source = "Test source 2026", layer = LAYER } = {},
) =>
  (
    await as(user, () =>
      one("select import_indicator_values($1, $2::jsonb, $3, $4) as counts", [
        layer,
        JSON.stringify(rows),
        replace,
        source,
      ]),
    )
  ).counts;

const row = (country_iso3, value, year = 2024, note = null) => ({
  country_iso3,
  value,
  year,
  note,
});

/** The layer's values as { ISO3: value }. */
const values = async (layer = LAYER) =>
  Object.fromEntries(
    (
      await q(
        "select country_iso3, value from indicator_values where indicator_id = $1 order by 1",
        [layer],
      )
    ).map((r) => [r.country_iso3, Number(r.value)]),
  );

/** Puts the test layer back to three imported (non-manual) values. */
async function resetLayer() {
  await q("delete from indicator_values where indicator_id = $1", [LAYER]);
  await q(
    `insert into indicator_values (indicator_id, country_iso3, value, year) values
       ($1, 'CZE', 1, 2020), ($1, 'DEU', 2, 2020), ($1, 'FRA', 3, 2020)`,
    [LAYER],
  );
  await q("update indicators set latest_year = 2020 where id = $1", [LAYER]);
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
  await db.exec(readFileSync(join(here, "..", "seed.sql"), "utf8"));
  await q(
    `insert into indicators (id, label, domain_min, domain_max, is_custom, latest_year) values
       ($1, 'Import test', 0, 100, true, 2020)`,
    [LAYER],
  );
  await q(
    "insert into indicators (id, label, type, is_custom) values ($1, 'Import regime', 'categorical', true)",
    [CATEGORIES],
  );
  await q(
    `insert into indicator_categories (indicator_id, value, label, color) values
       ($1, 0, 'Closed autocracy', '#8c2f39'), ($1, 1, 'Electoral autocracy', '#d98e5a')`,
    [CATEGORIES],
  );
  const people = [
    [id.admin, "admin", "staff"],
    [id.dataEditor, "data-editor", "staff"],
    [id.editor, "content-editor", "staff"],
    [id.reader, "reader", "reader"],
  ];
  for (const [uid, role, kind] of people) {
    await q("insert into auth.users (id, email) values ($1, $2)", [
      uid,
      `${role}-import@atlasoftodaysworld.org`,
    ]);
    await q("update profiles set role_id = $2, kind = $3, status = 'active' where id = $1", [
      uid,
      role,
      kind,
    ]);
  }
});

test("import: the test roles hold the rights the tests assume", async () => {
  const has = (user, section, action) =>
    as(user, async () => (await one("select has_perm($1, $2) as ok", [section, action])).ok);
  assert.equal(await has(id.admin, "layers", "d"), true);
  assert.equal(await has(id.dataEditor, "layers", "e"), true);
  assert.equal(await has(id.dataEditor, "layers", "d"), false);
  assert.equal(await has(id.editor, "layers", "e"), false);
  assert.equal(await has(id.editor, "regions", "e"), false);
});

test("import: anon can't call it; readers and editors without the right are refused", async () => {
  await resetLayer();
  await refused(importAs(null, [row("CZE", 9)]), /permission denied/);
  await refused(importAs(id.reader, [row("CZE", 9)]), /can't change the values of data layers/);
  await refused(importAs(id.editor, [row("CZE", 9)]), /can't change the values of data layers/);
  assert.deepEqual(await values(), { CZE: 1, DEU: 2, FRA: 3 });
});

test("import, update only: writes the file's countries and keeps the others", async () => {
  await resetLayer();
  const counts = await importAs(id.dataEditor, [
    row("CZE", 10),
    row("POL", 4),
    row("DEU", 2, 2020),
  ]);
  assert.deepEqual(counts, { added: 1, changed: 1, unchanged: 1, removed: 0 });
  assert.deepEqual(await values(), { CZE: 10, DEU: 2, FRA: 3, POL: 4 });

  // Written rows are manual values with the import's source and the editor stamped;
  // the row that was already the same is left as it was (imported, no source).
  const stored = await q(
    `select country_iso3, is_manual, source_note, updated_by, year from indicator_values
      where indicator_id = $1 order by 1`,
    [LAYER],
  );
  const byCountry = Object.fromEntries(stored.map((r) => [r.country_iso3, r]));
  for (const country of ["CZE", "POL"]) {
    assert.equal(byCountry[country].is_manual, true, country);
    assert.equal(byCountry[country].source_note, "Test source 2026", country);
    assert.equal(byCountry[country].updated_by, id.dataEditor, country);
    assert.equal(byCountry[country].year, 2024, country);
  }
  assert.equal(byCountry.DEU.is_manual, false);
  assert.equal(byCountry.DEU.source_note, null);

  // The layer's latest year follows the values.
  assert.equal(
    (await one("select latest_year from indicators where id = $1", [LAYER])).latest_year,
    2024,
  );
});

test("import, replace: countries missing from the file lose their value (layers 'd')", async () => {
  await resetLayer();
  const counts = await importAs(id.admin, [row("CZE", 5, null, "estimate"), row("ITA", 6)], {
    replace: true,
  });
  assert.deepEqual(counts, { added: 1, changed: 1, unchanged: 0, removed: 2 });
  assert.deepEqual(await values(), { CZE: 5, ITA: 6 });
  const cze = await one(
    "select year, note from indicator_values where indicator_id = $1 and country_iso3 = 'CZE'",
    [LAYER],
  );
  assert.deepEqual({ ...cze }, { year: null, note: "estimate" });
});

test("import, replace: without layers 'd' it's refused when it would remove — and changes nothing", async () => {
  await resetLayer();
  await refused(
    importAs(id.dataEditor, [row("CZE", 50), row("ITA", 6)], { replace: true }),
    /needs delete permission for data layers/,
  );
  assert.deepEqual(await values(), { CZE: 1, DEU: 2, FRA: 3 });

  // A file that covers every current country removes nothing, so it goes through.
  const counts = await importAs(
    id.dataEditor,
    [row("CZE", 1, 2020), row("DEU", 2, 2020), row("FRA", 7)],
    {
      replace: true,
    },
  );
  assert.deepEqual(counts, { added: 0, changed: 1, unchanged: 2, removed: 0 });
  assert.deepEqual(await values(), { CZE: 1, DEU: 2, FRA: 7 });
});

test("import: limits and row shape, checked before anything is written", async () => {
  await resetLayer();
  const bad = [
    [[], /1 to 1000 countries/],
    [Array.from({ length: 1001 }, () => row("CZE", 1)), /1 to 1000 countries/],
    [[row("CZE", 1), row("CZE", 2)], /CZE appears more than once/],
    [[row("ZZZ", 1)], /ZZZ is not in the Atlas/],
    [[row("cze", 1)], /not valid/],
    [[{ country_iso3: "CZE", value: "1" }], /not valid/],
    [[row("CZE", 1, 1799)], /not valid/],
    [[row("CZE", 1, 2024.5)], /not valid/],
    [[row("CZE", 1, 2024, "x".repeat(121))], /not valid/],
    [[row("DEU", 9), "CZE"], /not valid/],
  ];
  for (const [rows, pattern] of bad) {
    await refused(importAs(id.admin, rows, { replace: true }), pattern);
  }
  await refused(importAs(id.admin, [row("CZE", 1)], { source: "  " }), /needs a source/);
  await refused(importAs(id.admin, [row("CZE", 1)], { source: "x".repeat(301) }), /needs a source/);
  await refused(importAs(id.admin, [row("CZE", 1)], { layer: "no-such-layer" }), /doesn't exist/);
  assert.deepEqual(await values(), { CZE: 1, DEU: 2, FRA: 3 });

  // The upper limits themselves pass.
  const counts = await importAs(id.admin, [row("CZE", 1, 2100, "x".repeat(120))], {
    source: "s".repeat(300),
  });
  assert.equal(counts.changed, 1);
});

test("import: every country of the Atlas in one call", async () => {
  await resetLayer();
  const all = (await q("select iso3 from countries order by iso3")).map((r) => r.iso3);
  const counts = await importAs(
    id.admin,
    all.map((iso3, index) => row(iso3, index / 10, 2025)),
    { replace: true },
  );
  assert.equal(counts.added + counts.changed, all.length);
  assert.equal(Object.keys(await values()).length, all.length);
  assert.equal(
    (await one("select latest_year from indicators where id = $1", [LAYER])).latest_year,
    2025,
  );
});

test("import, categorical layer: only the layer's category codes", async () => {
  await refused(
    importAs(id.dataEditor, [row("CZE", 1), row("DEU", 3)], { layer: CATEGORIES }),
    /Value 3 is not one of this layer's categories/,
  );
  assert.deepEqual(await values(CATEGORIES), {});
  const counts = await importAs(id.dataEditor, [row("CZE", 1), row("DEU", 0)], {
    layer: CATEGORIES,
  });
  assert.deepEqual(counts, { added: 2, changed: 0, unchanged: 0, removed: 0 });
});

test("import: the function is security invoker with a fixed search_path", async () => {
  const fn = await one(
    `select prosecdef, proconfig from pg_proc
      where proname = 'import_indicator_values' and pronamespace = 'public'::regnamespace`,
  );
  assert.equal(fn.prosecdef, false);
  assert.deepEqual(fn.proconfig, ["search_path=public, pg_temp"]);
});
