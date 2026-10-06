import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

/**
 * Seed from today's content: it passes the schema, can be rerun and doesn't
 * overwrite editors' later changes. Assumes `npm run db:seed` has built the seed.
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

test("seed fills everything the Atlas is drawn from", async () => {
  // The 9 regions of the snapshot + Antarctica (migration 20261006000030).
  assert.equal(await count("regions"), 10);
  assert.ok((await count("countries")) >= 228);
  assert.equal(await count("indicators"), 9);
  assert.ok((await count("indicator_values")) > 1500);
  assert.equal(await count("indicator_categories"), 4);
  assert.ok((await count("special_regions")) >= 1);
  assert.ok((await count("entries")) >= 8);
  assert.ok((await count("timeline_events")) >= 1);
  assert.ok((await count("portrait_metrics")) >= 1);
});

test("disputed territories carry a note and Kosovo is XKX", async () => {
  const kosovo = (await db.query("select slug, territory_note from countries where iso3 = 'XKX'"))
    .rows[0];
  assert.equal(kosovo.slug, "kosovo");
  assert.match(kosovo.territory_note, /1244/);
});

test("anonymous reader gets news along with linked countries", async () => {
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

test("anonymous user gets the whole portrait in one portrait() call", async () => {
  await db.exec("set role anon");
  const region = (await db.query("select portrait('region', 'eastern-europe-central-asia') as p"))
    .rows[0].p;
  const mena = (await db.query("select portrait('region', 'middle-east-north-africa') as p"))
    .rows[0].p;
  const issue = (await db.query("select portrait('issue', 'russia-ukraine-war') as p")).rows[0].p;
  const missing = (await db.query("select portrait('region', 'atlantis') as p")).rows[0].p;
  await db.exec("reset role");

  assert.ok(region.timeline.length > 0);
  assert.ok(region.timeline.every((t) => t.date && t.title));
  assert.ok(mena.intro.length > 0);
  assert.ok(mena.metrics.length > 0);
  assert.ok(mena.metrics.every((m) => m.source));
  assert.ok(Array.isArray(issue.faq));
  assert.equal(missing, null);
});

test("seed carries over region photos, news covers and country profiles", async () => {
  // Antarctica comes from a migration, not from the snapshot; editors add its photo.
  const noHero = (
    await db.query("select slug from regions where hero_url is null and slug <> 'antarctica'")
  ).rows;
  assert.deepEqual(noHero, []);
  const covers = Number(
    (await db.query("select count(*) n from entries where cover_url is not null")).rows[0].n,
  );
  assert.ok(covers > 0);
  const ukraine = (await db.query("select profile_html from countries where iso3 = 'UKR'")).rows[0];
  assert.match(ukraine.profile_html, /<p>/);
  assert.doesNotMatch(ukraine.profile_html, /<script/i);
});

test("news HTML is sanitized", async () => {
  const bad = (
    await db.query(`select slug from entries where body_html ~* '<script|onerror=|javascript:'`)
  ).rows;
  assert.deepEqual(bad, []);
});

test("second run duplicates nothing and keeps manual edits", async () => {
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
  assert.equal(Number(value.value), 0.123, "manual value kept");
  const entry = (await db.query("select title from entries where slug = 'sahel-coup-belt'"))
    .rows[0];
  assert.equal(entry.title, "Edited by the newsroom", "edited article kept");
  const region = (
    await db.query("select intro from regions where slug = 'middle-east-north-africa'")
  ).rows[0];
  assert.equal(region.intro, "Written in the admin", "intro from the admin kept");
});
