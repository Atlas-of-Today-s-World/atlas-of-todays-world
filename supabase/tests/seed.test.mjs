import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

/**
 * Seed z dnešního obsahu: projde schématem, jde pustit znovu a nepřepíše,
 * co redakce mezitím změnila. Předpoklad: `npm run db:seed` už seed vyrobil.
 */

const here = dirname(fileURLToPath(import.meta.url));
const db = new PGlite();
const seed = readFileSync(join(here, "..", "seed.sql"), "utf8");
const count = async (table) =>
  Number((await db.query(`select count(*) as n from public.${table}`)).rows[0].n);

before(async () => {
  await db.exec(readFileSync(join(here, "supabase-stubs.sql"), "utf8"));
  const dir = join(here, "..", "migrations");
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    await db.exec(readFileSync(join(dir, file), "utf8"));
  }
  await db.exec(seed);
});

test("seed naplní všechno, z čeho se kreslí Atlas", async () => {
  assert.equal(await count("regions"), 9);
  assert.ok((await count("countries")) >= 228);
  assert.equal(await count("indicators"), 9);
  assert.ok((await count("indicator_values")) > 1500);
  assert.equal(await count("indicator_categories"), 4);
  assert.ok((await count("special_regions")) >= 1);
  assert.ok((await count("entries")) >= 8);
  assert.ok((await count("timeline_events")) >= 1);
  assert.ok((await count("portrait_metrics")) >= 1);
});

test("sporná území nesou poznámku a Kosovo je XKX", async () => {
  const kosovo = (await db.query("select slug, territory_note from countries where iso3 = 'XKX'"))
    .rows[0];
  assert.equal(kosovo.slug, "kosovo");
  assert.match(kosovo.territory_note, /1244/);
});

test("anonymní čtenář dostane novinky i s napojenými zeměmi", async () => {
  await db.exec("set role anon");
  const rows = (
    await db.query(`
    select e.slug, count(ec.country_iso3)::int as countries
    from entries e left join entry_countries ec on ec.entry_id = e.id
    group by e.slug order by e.slug`)
  ).rows;
  await db.exec("reset role");
  assert.ok(rows.length >= 8);
  assert.ok(rows.some((r) => r.countries > 0));
});

test("HTML novinek je vyčištěné", async () => {
  const bad = (
    await db.query(`select slug from entries where body_html ~* '<script|onerror=|javascript:'`)
  ).rows;
  assert.deepEqual(bad, []);
});

test("druhé spuštění nic nezdvojí a ruční práci nepřepíše", async () => {
  const before = {
    values: await count("indicator_values"),
    entries: await count("entries"),
    timeline: await count("timeline_events"),
  };
  await db.exec(`
    update indicator_values set value = 0.123, is_manual = true, source_note = 'test' where indicator_id = 'hdi' and country_iso3 = 'CZE';
    update entries set title = 'Edited by the newsroom' where slug = 'sahel-coup-belt';
    update regions set intro = 'Written in the admin' where slug = 'middle-east-north-africa';
  `);
  await db.exec(seed);
  assert.deepEqual(
    {
      values: await count("indicator_values"),
      entries: await count("entries"),
      timeline: await count("timeline_events"),
    },
    before,
  );
  const value = (
    await db.query(
      "select value from indicator_values where indicator_id = 'hdi' and country_iso3 = 'CZE'",
    )
  ).rows[0];
  assert.equal(Number(value.value), 0.123, "ruční hodnota zůstala");
  const entry = (await db.query("select title from entries where slug = 'sahel-coup-belt'"))
    .rows[0];
  assert.equal(entry.title, "Edited by the newsroom", "upravený článek zůstal");
  const region = (
    await db.query("select intro from regions where slug = 'middle-east-north-africa'")
  ).rows[0];
  assert.equal(region.intro, "Written in the admin", "úvod z administrace zůstal");
});
