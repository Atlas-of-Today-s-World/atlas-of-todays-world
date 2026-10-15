import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

/**
 * Short and broad queries stay cheap and bounded (migration
 * 20261013000320_short_query_search): search() needs a word of three
 * characters and returns before searching without one; both search() and
 * search_topics() rank only a bounded number of matching chapters, those with
 * a query word in the heading first.
 *
 * The data: the seed plus 70 published topics with 6 chapters each, every
 * chapter some hundreds of words drawn from a small vocabulary, so a common
 * word or a two-letter prefix matches every chapter (more than either bound).
 * Work is counted with track_functions (calls of the helpers per query),
 * time with generous bounds.
 *
 * Run: npm run test:db
 */

const here = dirname(fileURLToPath(import.meta.url));
const migrations = join(here, "..", "migrations");
const db = new PGlite();

const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const one = async (sql, params = []) => (await q(sql, params))[0];

const TOPICS = 70;
const CHAPTERS = 6;

/** Runs `fn` as the anonymous web reader. */
async function asAnon(fn) {
  await db.exec("set role anon");
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}

/** Rows and milliseconds of one call, as anon (the best of three runs). */
async function timed(sql, params) {
  return asAnon(async () => {
    let best = Infinity;
    let rows = [];
    for (let run = 0; run < 3; run++) {
      const start = performance.now();
      rows = await q(sql, params);
      best = Math.min(best, performance.now() - start);
    }
    return { rows, ms: best };
  });
}

/**
 * How often each helper ran during `sql` (track_functions). Counts not yet
 * flushed to the shared statistics add up across transactions, so this is the
 * difference before and after, inside one transaction.
 */
async function helperCalls(sql, params) {
  const counts = async () =>
    Object.fromEntries(
      (
        await q(
          `select funcname, calls::int from pg_stat_xact_user_functions where schemaname = 'public'`,
        )
      ).map((row) => [row.funcname, row.calls]),
    );
  await db.exec("begin");
  try {
    const before = await counts();
    await q(sql, params);
    const after = await counts();
    return Object.fromEntries(
      Object.entries(after)
        .map(([name, calls]) => [name, calls - (before[name] ?? 0)])
        .filter(([, calls]) => calls > 0),
    );
  } finally {
    await db.exec("rollback");
  }
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

  // Every chapter: one paragraph of 400 words from a small vocabulary (the
  // same seed every run). "the", "water" and "wa…" are in nearly all of them.
  await db.exec(`
    select setseed(0.42);
    create temporary table vocabulary as
      select string_to_array(
        'the the the of of and and water water war was way wall wave policy people '
        || 'migration border trade river delta coast drought harvest market rights '
        || 'court army power state region climate energy grain fishing transit', ' ') as words;

    insert into entries (slug, title, summary, category, region_slug, status, kind, body_html)
      select 'bulk-' || n, 'Bulk topic ' || to_char(n, 'FM000'), 'Summary of topic ' || n, 'Society',
             (select slug from regions order by slug limit 1), 'published', 'entry',
             '<p>' || (select string_agg(v.words[1 + floor(random() * cardinality(v.words))::int], ' ')
                       from generate_series(1, 60 + 0 * n), vocabulary v) || '</p>'
      from generate_series(1, ${TOPICS}) n;

    insert into entry_chapters (entry_id, position, title, body_html)
      select e.id, p, 'Chapter ' || p || ' of ' || e.title,
             '<p>' || (select string_agg(v.words[1 + floor(random() * cardinality(v.words))::int], ' ')
                       from generate_series(1, 400 + 0 * p), vocabulary v) || '</p>'
      from entries e, generate_series(0, ${CHAPTERS - 1}) p
      where e.slug like 'bulk-%';

    -- Last in every order by title, but its chapter's heading holds the word
    -- and its text is full of it.
    insert into entries (slug, title, summary, category, region_slug, status, kind, body_html)
      values ('zz-last-topic', 'Zz last topic', 'Nothing here.', 'Society',
              (select slug from regions order by slug limit 1), 'published', 'entry', '');
    insert into entry_chapters (entry_id, position, title, body_html)
      select id, 0, 'Water and wells', '<p>' || repeat('Water from wells. ', 150) || '</p>'
      from entries where slug = 'zz-last-topic';

    drop table vocabulary;
    analyze;
    set track_functions = 'all';
  `);
});

test("the data matches more chapters than either bound", async () => {
  const count = async (words) =>
    (
      await one(
        "select count(*)::int as n from entry_chapters where search @@ prefix_tsquery($1::text[])",
        [words],
      )
    ).n;
  assert.ok((await count(["the"])) >= TOPICS * CHAPTERS);
  assert.ok((await count(["wa"])) >= TOPICS * CHAPTERS);
  assert.equal(await count(["wells"]), 1);
});

test("search(): no word of three characters returns at once, without searching", async () => {
  for (const text of ["a", "ab", "of in", "a-b c'd", "", null]) {
    const calls = await helperCalls("select * from search($1, 40)", [text]);
    assert.deepEqual(
      await asAnon(() => q("select * from search($1, 40)", [text])),
      [],
      `search(${JSON.stringify(text)})`,
    );
    assert.equal(calls.search_words ?? 0, 0, `search(${JSON.stringify(text)}) went on searching`);
  }
  const { ms } = await timed("select * from search('a', 40)");
  assert.ok(ms < 100, `search('a') took ${ms.toFixed(0)} ms`);
});

test("search(): a word in every chapter is ranked over a bounded set, in bounded time", async () => {
  for (const text of ["the", "water", "wal"]) {
    const { rows, ms } = await timed("select * from search($1, 40)", [text]);
    assert.ok(rows.length > 0 && rows.length <= 40, `search('${text}'): ${rows.length} rows`);
    assert.ok(ms < 2000, `search('${text}') took ${ms.toFixed(0)} ms`);
  }
  // The default and the bounds of p_limit still apply.
  assert.equal((await q("select * from search('the')")).length, 12);
  assert.equal((await q("select * from search('the', 1000)")).length, 40);
  assert.equal((await q("select * from search('the', 0)")).length, 1);
});

test("search_topics(): at most 100 parts are scored, at most 50 get a snippet", async () => {
  for (const text of ["wa", "the", "water policy"]) {
    const calls = await helperCalls("select * from search_topics($1, 50)", [text]);
    assert.ok((calls.topic_hit_score ?? 0) <= 100, `${text}: ${calls.topic_hit_score} scored`);
    assert.ok((calls.search_snippet ?? 0) <= 50, `${text}: ${calls.search_snippet} snippets`);
    // Introductions are matched from the index, not rebuilt from their HTML
    // (only scored ones are: at most 100).
    assert.ok(
      (calls.topic_intro_search ?? 0) <= 100,
      `${text}: ${calls.topic_intro_search} intros rebuilt`,
    );
  }
  // No word of two characters: nothing is matched or scored.
  const none = await helperCalls("select * from search_topics('x', 50)");
  assert.equal(none.topic_hit_score, undefined);
  assert.equal(none.search_snippet, undefined);
});

test("a heading match is ranked even when its topic sorts last", async () => {
  // "water" is in every chapter, far more than get ranked; the topic sorting
  // last by title has it in a chapter heading (and all over that chapter).
  const [first] = await asAnon(() => q("select slug, heading, anchor from search_topics('water')"));
  assert.deepEqual(
    { ...first },
    { slug: "zz-last-topic", heading: "Water and wells", anchor: "topic-1" },
  );
  const site = await asAnon(() => q("select id from search('water', 40)"));
  assert.ok(
    site.some((row) => row.id === "news:zz-last-topic"),
    "search() ranks the chapter and finds the topic",
  );
});

test("search_topics(): broad and two-letter queries take bounded time", async () => {
  for (const text of ["wa", "th", "the", "water", "migration policy"]) {
    const { rows, ms } = await timed("select * from search_topics($1)", [text]);
    assert.ok(rows.length <= 30, `search_topics('${text}'): ${rows.length} rows`);
    assert.ok(ms < 5000, `search_topics('${text}') took ${ms.toFixed(0)} ms`);
  }
});

test("both functions stay security definer with bitmap scans only", async () => {
  const fns = await q(
    `select proname, prosecdef, (select lanname from pg_language l where l.oid = prolang) as lang, proconfig from pg_proc
     where pronamespace = 'public'::regnamespace and proname in ('search', 'search_topics') order by 1`,
  );
  for (const fn of fns) {
    assert.equal(fn.prosecdef, true, fn.proname);
    assert.equal(fn.lang, "plpgsql", fn.proname);
    assert.deepEqual(fn.proconfig, [
      "search_path=public, pg_temp",
      "enable_seqscan=off",
      "enable_indexscan=off",
    ]);
  }
  // Rebuilding an introduction is priced as it costs, so it comes from the index.
  const plan = (
    await q(
      `explain select id from entries
       where kind = 'entry' and status = 'published' and translation_of is null
         and topic_intro_search(title, summary, body_html) @@ prefix_tsquery(array['water'])`,
    )
  )
    .map((row) => row["QUERY PLAN"])
    .join("\n");
  assert.match(plan, /entries_topic_intro_search/);
});
