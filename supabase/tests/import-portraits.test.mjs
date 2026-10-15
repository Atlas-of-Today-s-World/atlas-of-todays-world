import { test, before } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

/**
 * The old site's portraits imported as SQL (scripts/webflow/import-portraits.mjs
 * --sql, the production path) into the migrated and seeded database: what is
 * written, what is kept, a repeated run and --replace. The SQL runs as the
 * database owner, as psql does in the workflow.
 *
 * Run: npm run test:db
 */

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const migrations = join(here, "..", "migrations");
const db = new PGlite();
const work = mkdtempSync(join(tmpdir(), "import-portraits-"));

const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const one = async (sql, params = []) => (await q(sql, params))[0];

/** Generates the import SQL (optionally with --replace) and runs it. */
async function runImport(...flags) {
  const file = join(work, `import-${flags.join("") || "plain"}.sql`);
  execFileSync(
    process.execPath,
    ["scripts/webflow/import-portraits.mjs", "--sql", file, ...flags],
    { cwd: root, stdio: "pipe" },
  );
  await db.exec(readFileSync(file, "utf8"));
}

const MENA = "middle-east-north-africa";
const WAR = "russia-ukraine-war";

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
});

test.after(() => rmSync(work, { recursive: true, force: true }));

test("import: starting point — the seed's MENA intro and cards, nothing for the war", async () => {
  assert.notEqual((await one("select intro from regions where slug = $1", [MENA])).intro, "");
  assert.equal(
    (await one("select count(*)::int as n from portrait_metrics where region_slug = $1", [MENA])).n,
    6,
  );
  assert.equal(
    (await one("select count(*)::int as n from timeline_events where special_slug = $1", [WAR])).n,
    0,
  );
});

test("import: fills what is empty and keeps what editors wrote", async () => {
  const introBefore = (await one("select intro from regions where slug = $1", [MENA])).intro;
  const cardsBefore = await q(
    "select value, label, source_url from portrait_metrics where region_slug = $1 order by position",
    [MENA],
  );
  await runImport();

  // MENA: intro and cards were there, so they stay; the timeline was empty.
  assert.equal((await one("select intro from regions where slug = $1", [MENA])).intro, introBefore);
  assert.deepEqual(
    await q(
      "select value, label, source_url from portrait_metrics where region_slug = $1 order by position",
      [MENA],
    ),
    cardsBefore,
  );
  const region = await one(
    "select timeline_title, timeline_subtitle from regions where slug = $1",
    [MENA],
  );
  assert.equal(region.timeline_title, "Historical Context of the Region");
  assert.equal(region.timeline_subtitle, "An overview of the key events.");
  const events = await q(
    `select position, date_label, title, body, body_html, sources from timeline_events
      where region_slug = $1 order by position`,
    [MENA],
  );
  assert.equal(events.length, 21);
  assert.equal(events[0].title, "Fall of the Ottoman Empire and wartime agreements");
  assert.equal(events[0].date_label, "1924");
  assert.match(events[0].body_html, /^<p>The Ottoman Empire \(1516-1924\)/);
  assert.match(events[0].body, /^The Ottoman Empire \(1516-1924\)[^<]*\n\nEntente proposals/);
  assert.equal(events[0].sources.length, 3);
  assert.ok(events.every((event) => event.sources.every((s) => s.url.startsWith("https://"))));
  assert.deepEqual(
    events.map((event) => event.position),
    events.map((_, index) => index),
  );

  // The war: an intro, six cards and fifteen events, all new.
  const war = await one(
    "select intro, timeline_title, timeline_subtitle from special_regions where slug = $1",
    [WAR],
  );
  assert.match(war.intro, /^A comprehensive portrait of the war/);
  assert.equal(war.timeline_title, "Historical Context of the War");
  const cards = await q(
    "select value, label, source, source_url from portrait_metrics where special_slug = $1 order by position",
    [WAR],
  );
  assert.equal(cards.length, 6);
  assert.deepEqual(cards[0], {
    value: "51 245",
    label: "Ukrainian Soldiers Killed",
    source: "UA Losses, 9. 5. 2024",
    source_url: null, // "#" on the old site
  });
  const warEvents = await q(
    "select title, body_html from timeline_events where special_slug = $1 order by position",
    [WAR],
  );
  assert.equal(warEvents.length, 15);
  assert.ok(warEvents.every((event) => event.body_html.startsWith("<p>")));

  // The portrait reads it all, as the site does.
  const portrait = (await one("select portrait('region', $1) as p", [MENA])).p;
  assert.equal(portrait.timeline.length, 21);
  assert.equal(portrait.timeline[0].sources.length, 3);
});

test("import: a second run changes nothing an editor changed since", async () => {
  await q(
    "update timeline_events set title = 'Edited by the team' where region_slug = $1 and position = 0",
    [MENA],
  );
  await q("delete from timeline_events where special_slug = $1 and position = 14", [WAR]);
  await runImport();
  assert.equal(
    (await one("select title from timeline_events where region_slug = $1 and position = 0", [MENA]))
      .title,
    "Edited by the team",
  );
  assert.equal(
    (await one("select count(*)::int as n from timeline_events where special_slug = $1", [WAR])).n,
    14,
  );
});

test("import: --replace puts the old site's cards and timeline back", async () => {
  await runImport("--replace");
  const cards = await q(
    "select value, source_url from portrait_metrics where region_slug = $1 order by position",
    [MENA],
  );
  assert.equal(cards.length, 6);
  assert.equal(cards[1].value, "10%");
  assert.ok(cards.every((card) => card.source_url?.startsWith("https://")));
  assert.equal(
    (await one("select title from timeline_events where region_slug = $1 and position = 0", [MENA]))
      .title,
    "Fall of the Ottoman Empire and wartime agreements",
  );
  assert.equal(
    (await one("select count(*)::int as n from timeline_events where special_slug = $1", [WAR])).n,
    15,
  );
});
