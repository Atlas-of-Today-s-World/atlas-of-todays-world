import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { LATER_DATA_CHANGES } from "./later-data-changes.mjs";

/**
 * Low-priority DB findings (review 2026-10-07, D-L1 … D-L6), migrations
 * 20261012000010–20261012000014.
 *
 * The harness stops before those migrations, loads the seed plus a few
 * fixtures, records what search() returns, then applies the rest — so the
 * rewritten search() is compared with the previous one on the same data.
 *
 * Run: npm run test:db
 */

const here = dirname(fileURLToPath(import.meta.url));
const migrations = join(here, "..", "migrations");
const FIRST_NEW = "20261012000010";
const db = new PGlite();

const id = {
  scheduler: "00000000-0000-4000-8000-0000000000a1",
  author: "00000000-0000-4000-8000-0000000000a2",
};

const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const one = async (sql, params = []) => (await q(sql, params))[0];

/**
 * Runs `fn` with auth.uid() = `user` while staying the database owner: RLS
 * doesn't apply, so the triggers are tested in isolation.
 */
async function signedIn(user, fn) {
  await db.exec(`select set_config('request.jwt.claim.sub', '${user ?? ""}', false)`);
  try {
    return await fn();
  } finally {
    await db.exec("select set_config('request.jwt.claim.sub', '', false)");
  }
}

/** Runs `fn` as the anonymous web reader. */
async function asAnon(fn) {
  await db.exec("set role anon");
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}

const SEARCHES = [
  "ukraine",
  "russia war",
  "china",
  "africa",
  "brazil",
  "brazilian rainforest",
  "climate",
  "water",
  "election",
  "east asia",
  "sudan",
  "korea",
  "india",
  "zz-no-hit",
  "",
];

/** All rows of search() in a total order (ties broken by id), as plain objects. */
async function searchAll(text) {
  const rows = await q("select * from search($1, 40) order by rank desc, title, id", [text]);
  return rows.map((row) => ({ ...row }));
}

async function snapshotSearches() {
  const out = {};
  for (const text of SEARCHES) {
    out[text] = { owner: await searchAll(text), anon: await asAnon(() => searchAll(text)) };
  }
  return out;
}

let before_ = null;

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
  // Later migrations change searchable rows too; compare the functions on the same data.
  await db.exec(LATER_DATA_CHANGES);

  // Entries that match only through a tagged country, through both, a draft
  // and a translation (neither of the last two may ever show up).
  await db.exec(`
    insert into entries (slug, title, summary, category, region_slug, status, kind, published_on) values
      ('zz-amazon-tagged', 'Rainforest logging slows', 'Deforestation fell this year.', 'Society',
       'latin-america-caribbean', 'published', 'news', '2026-09-01'),
      ('zz-brazil-both', 'Brazil votes', 'Brazil holds a general election.', 'Political System',
       'latin-america-caribbean', 'published', 'entry', null),
      ('zz-brazil-draft', 'Brazil draft', 'Not yet out.', 'Political System',
       'latin-america-caribbean', 'draft', 'news', null);
    insert into entry_countries (entry_id, country_iso3)
      select id, 'BRA' from entries where slug in ('zz-amazon-tagged', 'zz-brazil-both', 'zz-brazil-draft');
    insert into entries (slug, title, summary, category, region_slug, status, kind, locale, translation_of)
      select slug, 'Brazílie volí', 'Brazílie volí.', category, region_slug, 'published', kind, 'cs', id
      from entries where slug = 'zz-brazil-both';
  `);

  before_ = await snapshotSearches();
  await apply(files.filter((f) => f >= FIRST_NEW));

  for (const [uid, email] of [
    [id.scheduler, "scheduler@atlasoftodaysworld.org"],
    [id.author, "author@atlasoftodaysworld.org"],
  ]) {
    await q("insert into auth.users (id, email) values ($1, $2)", [uid, email]);
  }
});

// ---------------------------------------------------------------------------
// D-L1: search() without OR-ed subquery
// ---------------------------------------------------------------------------

test("D-L1: search() returns the same rows, ranks and order as before", async () => {
  const after = await snapshotSearches();
  for (const text of SEARCHES) {
    // Under 40 rows, so no tie at the limit can make the comparison flaky.
    assert.ok(before_[text].owner.length < 40, `"${text}" hits the limit; pick a narrower query`);
    assert.deepEqual(after[text].owner, before_[text].owner, `search("${text}") changed`);
    assert.deepEqual(after[text].anon, before_[text].anon, `search("${text}") changed for anon`);
  }
  // The fixtures exercise both match paths and the exclusions.
  const brazil = after.brazil.anon.filter((row) => row.kind === "news").map((row) => row.id);
  assert.ok(brazil.includes("news:zz-amazon-tagged"), "country-only match is found");
  assert.ok(brazil.includes("news:zz-brazil-both"), "text match is found");
  assert.ok(!brazil.includes("news:zz-brazil-draft"), "drafts never show");
  assert.equal(
    brazil.filter((slug) => slug === "news:zz-brazil-both").length,
    1,
    "no translation twice",
  );
  const tagged = after.brazil.anon.find((row) => row.id === "news:zz-amazon-tagged");
  assert.equal(tagged.rank, 0.5);
  assert.ok(after.ukraine.anon.length > 0, "the seed has hits for a common query");
});

test("D-L1: the default limit and the bounds of p_limit still apply", async () => {
  const count = async (sql) => (await one(`select count(*)::int as n from ${sql}`)).n;
  assert.ok((await count("search('a')")) <= 12);
  assert.ok((await count("search('a', 0)")) <= 1);
  assert.ok((await count("search('a', 1000)")) <= 40);
});

// ---------------------------------------------------------------------------
// D-L2: hit_rate_limit tidies only the caller's key
// ---------------------------------------------------------------------------

test("D-L2: hit_rate_limit counts as before and removes only its own expired windows", async () => {
  await q(
    `insert into rate_limits (key, window_start, hits) values
       ('mine', now() - interval '2 days', 9), ('theirs', now() - interval '2 days', 9)`,
  );
  const hits = [];
  for (let n = 0; n < 4; n++) {
    hits.push((await one("select hit_rate_limit('mine', 3, 600) as ok")).ok);
  }
  assert.deepEqual(hits, [true, true, true, false]);
  const left = await q(
    "select key, hits from rate_limits where key in ('mine', 'theirs') order by key",
  );
  assert.deepEqual(
    left.map((row) => ({ ...row })),
    [
      { key: "mine", hits: 4 },
      { key: "theirs", hits: 9 },
    ],
  );
  // The daily housekeeping job takes the rest.
  await q("select db_housekeeping()");
  assert.equal((await one("select count(*)::int as n from rate_limits where key = 'theirs'")).n, 0);
  await assert.rejects(q("select hit_rate_limit('x', 0, 600)"), /Invalid rate limit/);
});

// ---------------------------------------------------------------------------
// D-L3: the schedule drop runs once per statement
// ---------------------------------------------------------------------------

test("D-L3: part triggers are statement-level, one per event and table", async () => {
  const rows = await q(
    `select c.relname as tbl, t.tgname, (t.tgtype & 1) = 1 as per_row
     from pg_trigger t join pg_class c on c.oid = t.tgrelid
     where t.tgfoid = 'public.drop_schedule_on_parts_change()'::regprocedure`,
  );
  assert.equal(rows.length, 18);
  assert.ok(rows.every((row) => !row.per_row));
  const old = await one(
    "select count(*)::int as n from pg_proc where proname = 'drop_schedule_on_part_change'",
  );
  assert.equal(old.n, 0);
});

test("D-L3: a part change by anyone but the scheduler still drops the plan", async () => {
  const entry = (
    await one(
      `insert into entries (slug, title, summary, category, region_slug, owner_id, status)
       values ('zz-scheduled', 'Scheduled', 'Summary', 'Society', 'latin-america-caribbean', $1, 'pending')
       returning id`,
      [id.author],
    )
  ).id;
  const plan = () =>
    q("update entries set publish_at = now() + interval '1 day', scheduled_by = $2 where id = $1", [
      entry,
      id.scheduler,
    ]);
  const planned = async () =>
    (await one("select publish_at from entries where id = $1", [entry])).publish_at !== null;
  const addFaq = (from) =>
    q(
      `insert into entry_faq (entry_id, position, question, answer)
       select $1, n, 'Question ' || n, 'Answer' from generate_series($2::int, $2::int + 2) n`,
      [entry, from],
    );

  await plan();
  // The scheduler's own edits and service-key writes keep the plan.
  await signedIn(id.scheduler, () => addFaq(0));
  assert.equal(await planned(), true);
  await signedIn(null, () =>
    q("delete from entry_faq where entry_id = $1 and position = 0", [entry]),
  );
  assert.equal(await planned(), true);

  // Someone else: insert, update and delete each drop it.
  await signedIn(id.author, () => addFaq(10));
  assert.equal(await planned(), false);

  await plan();
  await signedIn(id.author, () =>
    q("update entry_faq set answer = 'Changed' where entry_id = $1", [entry]),
  );
  assert.equal(await planned(), false);

  await plan();
  await signedIn(id.author, () => q("delete from entry_faq where entry_id = $1", [entry]));
  assert.equal(await planned(), false);

  // A statement touching no rows changes nothing.
  await plan();
  await signedIn(id.author, () => q("delete from entry_faq where entry_id = $1", [entry]));
  assert.equal(await planned(), true);

  // Another entry's parts don't touch this plan.
  const other = (
    await one(
      `insert into entries (slug, title, summary, category, region_slug, owner_id, status)
       values ('zz-other', 'Other', 'Summary', 'Society', 'latin-america-caribbean', $1, 'draft')
       returning id`,
      [id.author],
    )
  ).id;
  await signedIn(id.author, () =>
    q("insert into entry_countries (entry_id, country_iso3) values ($1, 'BRA')", [other]),
  );
  assert.equal(await planned(), true);
  await signedIn(id.author, () =>
    q("insert into entry_countries (entry_id, country_iso3) values ($1, 'BRA')", [entry]),
  );
  assert.equal(await planned(), false);
});

// ---------------------------------------------------------------------------
// D-L4: index for the newest-first public lists
// ---------------------------------------------------------------------------

test("D-L4: the published list can be read in order from an index", async () => {
  await db.exec("set enable_seqscan = off; set enable_sort = off");
  try {
    const plan = (
      await q(
        `explain select slug from entries
         where status = 'published' and kind = 'news' and translation_of is null
         order by published_on desc nulls last limit 1000`,
      )
    )
      .map((row) => row["QUERY PLAN"])
      .join("\n");
    assert.match(plan, /entries_published_list/);
    assert.doesNotMatch(plan, /Sort/);
  } finally {
    await db.exec("reset enable_seqscan; reset enable_sort");
  }
});

// ---------------------------------------------------------------------------
// D-L6: record_page_view is gone
// ---------------------------------------------------------------------------

test("D-L6: record_page_view() no longer exists, the members overview still reads views", async () => {
  const fn = await one("select to_regprocedure('public.record_page_view()') as f");
  assert.equal(fn.f, null);
  const view = await one("select count(*)::int as n from members_overview");
  assert.ok(view.n >= 2);
});
