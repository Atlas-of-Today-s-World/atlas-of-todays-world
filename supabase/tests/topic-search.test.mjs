import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { LATER_DATA_CHANGES } from "./later-data-changes.mjs";

/**
 * Topic search in Postgres (migration 20261013000010_topic_search_in_db):
 * search_topics() for the Topics page, and search() finding topics by their
 * chapters.
 *
 * The harness stops before that migration, loads the seed plus fixture topics,
 * records what search() returns, then applies the rest — so search() is
 * compared with the previous version on the same data.
 *
 * Run: npm run test:db
 */

const here = dirname(fileURLToPath(import.meta.url));
const migrations = join(here, "..", "migrations");
const FIRST_NEW = "20261013000010";
const db = new PGlite();

const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const one = async (sql, params = []) => (await q(sql, params))[0];

/** Runs `fn` as the anonymous web reader. */
async function asAnon(fn) {
  await db.exec("set role anon");
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}

/** search_topics() rows as plain objects. */
const topics = async (text, limit) =>
  (
    await q(
      limit === undefined
        ? "select * from search_topics($1)"
        : "select * from search_topics($1, $2)",
      limit === undefined ? [text] : [text, limit],
    )
  ).map((row) => ({ ...row }));

const SEARCHES = [
  "ukraine",
  "russia war",
  "china",
  "africa",
  "brazil",
  "climate",
  "water",
  "election",
  "sudan",
  "smuggling",
  "libyan",
  "cote",
  "glacier",
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

  // Two published topics with chapters, a draft topic, a translation and a
  // news item — the last three must never show up in the topic search.
  await db.exec(`
    insert into entries (slug, title, summary, category, region_slug, status, kind, body_html) values
      ('zz-smuggling', 'Migrant Smuggling', 'How moving people across borders works.', 'Society',
       'latin-america-caribbean', 'published', 'entry',
       '<p>Smugglers sell <b>pass</b>age &amp; promises.</p>'),
      ('zz-sahel', 'The Sahel', 'Coups and trade.', 'Society',
       'latin-america-caribbean', 'published', 'entry', ''),
      ('zz-draft-topic', 'Glacier Draft', 'Not yet out.', 'Society',
       'latin-america-caribbean', 'draft', 'entry', '<p>Glacier melt.</p>'),
      ('zz-glacier-news', 'Glacier news', 'A news item.', 'Society',
       'latin-america-caribbean', 'published', 'news', '<p>Glacier melt in the Alps.</p>');
    insert into entries (slug, title, summary, category, region_slug, status, kind, locale, translation_of, body_html)
      select slug, 'Pašeráctví migrantů', 'Libyan glacier routes', category, region_slug,
             'published', kind, 'cs', id, '<p>Libyan glacier routes</p>'
      from entries where slug = 'zz-smuggling';

    insert into entry_chapters (entry_id, position, title, body_html)
      select id, 0, 'Why people move', '<p>Wars, poverty and hope.</p>' from entries where slug = 'zz-smuggling';
    insert into entry_chapters (entry_id, position, title, body_html)
      select id, 1, 'Smuggling Routes',
             '<p>Boats leave the Libyan coast at night.</p><p>Routes through C&#244;te d&#39;Ivoire and '
             || '<a href="/x">Côte d''Ivoire</a> and Niger shift with policy.</p>'
             || '<script>alert(1)</script><!-- glacier -->'
      from entries where slug = 'zz-smuggling';
    insert into entry_chapters (entry_id, position, title, body_html)
      select id, 3, 'Coups', '<p>Niger saw a coup in 2023. Trade routes changed.</p>'
      from entries where slug = 'zz-sahel';
    insert into entry_chapters (entry_id, position, title, body_html)
      select id, 7, 'Glacier retreat', '<p>Ice in the Sahel? No: glaciers, glacial lakes.</p>'
      from entries where slug = 'zz-sahel';
    insert into entry_chapters (entry_id, position, title, body_html)
      select id, 0, 'Glacier melt', '<p>Glacier melt everywhere.</p>' from entries where slug = 'zz-draft-topic';
  `);

  before_ = await snapshotSearches();
  await apply(files.filter((f) => f >= FIRST_NEW));
});

// ---------------------------------------------------------------------------
// search_topics()
// ---------------------------------------------------------------------------

test("search_topics: anon finds intros and chapters of published topics only", async () => {
  const rows = await asAnon(() => topics("glacier"));
  assert.deepEqual(
    rows.map((row) => [row.slug, row.anchor]),
    [["zz-sahel", "topic-2"]],
    "no draft topic, no news, no translation",
  );
  // Owner bypasses RLS: the function itself still keeps drafts out.
  assert.deepEqual(
    (await topics("glacier")).map((row) => row.slug),
    ["zz-sahel"],
  );

  const smuggling = await asAnon(() => topics("smuggling"));
  assert.deepEqual(
    smuggling.map((row) => ({ slug: row.slug, heading: row.heading, anchor: row.anchor })),
    // Equal scores (heading only): the intro first, then chapters in page order.
    [
      { slug: "zz-smuggling", heading: "Migrant Smuggling", anchor: null },
      { slug: "zz-smuggling", heading: "Smuggling Routes", anchor: "topic-2" },
    ],
  );
  assert.equal(smuggling[1].topic_title, "Migrant Smuggling");
});

test("search_topics: anchors count chapters in page order, not positions", async () => {
  const rows = await asAnon(() => topics("coups"));
  // 'Coups' sits at position 3 but is the sahel's first chapter; the intro also says "Coups".
  assert.deepEqual(
    rows.map((row) => [row.heading, row.anchor]),
    [
      ["Coups", "topic-1"],
      ["The Sahel", null],
    ],
  );
});

test("search_topics: every word must match, as a word prefix, accents and case ignored", async () => {
  const anchors = async (text) => (await asAnon(() => topics(text))).map((row) => row.anchor);
  assert.deepEqual(await anchors("cote niger"), ["topic-2"]);
  assert.deepEqual(await anchors("CÔTE"), ["topic-2"]);
  assert.deepEqual(await anchors("ivoir"), ["topic-2"]);
  assert.deepEqual(await anchors("smugg rout"), ["topic-2"]);
  assert.deepEqual(await anchors("niger zzzz"), []);
  // Words shorter than two characters are ignored; nothing left means no hits.
  assert.deepEqual(await anchors("x"), []);
  assert.deepEqual(await anchors(""), []);
  assert.deepEqual(await anchors(null), []);
  // Inline markup doesn't split a word; tags and comments aren't text.
  assert.deepEqual(await anchors("passage"), [null]);
  assert.deepEqual(await anchors("alert"), []);
  assert.deepEqual(
    (await asAnon(() => topics("glacier"))).map((row) => row.anchor),
    ["topic-2"],
    "an HTML comment doesn't make the smuggling chapter match",
  );
});

test("search_topics: heading matches rank first, then how often the words occur", async () => {
  const rows = await asAnon(() => topics("routes"));
  assert.deepEqual(
    rows.map((row) => [row.slug, row.anchor]),
    [
      ["zz-smuggling", "topic-2"],
      ["zz-sahel", "topic-1"],
    ],
  );
  // The old JS score: 1 occurrence in the text + 5 for the heading; 1 occurrence.
  assert.deepEqual(
    rows.map((row) => row.rank),
    [6, 1],
  );
  assert.ok(rows.every((row) => typeof row.rank === "number"));
});

test("search_topics: the snippet is plain text around the first hit", async () => {
  const [hit] = await asAnon(() => topics("libyan"));
  assert.equal(
    hit.snippet,
    "Boats leave the Libyan coast at night. Routes through Côte d'Ivoire and Côte d'Ivoire and Niger shift with policy.",
  );
  assert.doesNotMatch(hit.snippet, /[<>]|&[a-z#0-9]+;|alert/);

  const [intro] = await asAnon(() => topics("promises"));
  assert.equal(
    intro.snippet,
    "How moving people across borders works. Smugglers sell passage & promises.",
  );

  // A long text is cut at spaces around the first hit, with ellipses.
  const cut = await one("select search_snippet($1, array['libyan']) as s", [
    `${"word ".repeat(60)}the Libyan coast ${"more ".repeat(80)}end`,
  ]);
  assert.match(cut.s, /^… (word )+the Libyan coast (more )+…$/);
  assert.ok(cut.s.length <= 270, cut.s);
  const start = await one("select search_snippet($1, array['zzz']) as s", ["short text"]);
  assert.equal(start.s, "short text");
});

test("search_topics: typed input never becomes query syntax", async () => {
  for (const text of [
    "a'); drop table entries; --",
    "smuggling:* | wars",
    "!(smuggling) & routes",
    "routes <-> libyan",
    "\\ ' \" ; -- /* */",
    "''''",
    "x".repeat(5000),
  ]) {
    await asAnon(() => topics(text));
  }
  assert.equal((await one("select count(*)::int as n from entries")).n > 0, true);
  // Operators are only separators: "smuggling:* | wars" needs both words.
  assert.deepEqual(await asAnon(() => topics("smuggling:* | wars")), [
    ...(await asAnon(() => topics("smuggling wars"))),
  ]);
  assert.equal((await asAnon(() => topics("smuggling wars"))).length, 0);
});

test("search_topics: the limit is bounded", async () => {
  assert.equal((await topics("routes", 1)).length, 1);
  assert.equal((await topics("routes", 0)).length, 1);
  assert.equal((await topics("routes", -5)).length, 1);
  assert.equal((await topics("routes", 100000)).length, 2);
  assert.equal(
    (await one("select count(*)::int as n from search_topics('o', 100000)")).n,
    0,
    "one letter is no search",
  );
});

test("search_topics: matches come from the GIN indexes", async () => {
  await db.exec("set enable_seqscan = off");
  try {
    const plan = async (sql) =>
      (await q(`explain ${sql}`)).map((row) => row["QUERY PLAN"]).join("\n");
    assert.match(
      await plan("select id from entry_chapters where search @@ prefix_tsquery(array['routes'])"),
      /entry_chapters_search/,
    );
    // topic_intro_search() is declared expensive, so with a few hundred topics
    // the intro index answers the match instead of the indexes on (kind, …) or
    // (status, …) plus building every published topic's text.
    await db.exec(`
      begin;
      insert into entries (slug, title, summary, category, region_slug, status, kind, body_html)
        select 'zz-many-' || n, 'Topic ' || n, 'Summary ' || n, 'Society', 'latin-america-caribbean',
               'published', 'entry', '<p>Body text number ' || n || '.</p>'
        from generate_series(1, 300) n;
      analyze entries;
    `);
    assert.match(
      await plan(
        `select id from entries
         where kind = 'entry' and status = 'published' and translation_of is null
           and topic_intro_search(title, summary, body_html) @@ prefix_tsquery(array['routes'])`,
      ),
      /entries_topic_intro_search/,
    );
  } finally {
    await db.exec("rollback; reset enable_seqscan");
  }
});

test("chapter search vector follows edits to the chapter", async () => {
  await q(
    `update entry_chapters set body_html = '<p>Camels and caravans.</p>'
     where title = 'Coups'`,
  );
  try {
    assert.deepEqual(
      (await asAnon(() => topics("caravans"))).map((row) => row.anchor),
      ["topic-1"],
    );
    assert.deepEqual(
      (await asAnon(() => topics("coup 2023"))).map((row) => row.anchor),
      [],
    );
  } finally {
    await q(
      `update entry_chapters set body_html = '<p>Niger saw a coup in 2023. Trade routes changed.</p>'
       where title = 'Coups'`,
    );
  }
});

test("search_words: the same words as the app's queryWords()", async () => {
  // src/features/topics/text-search.test.ts expects the same.
  const words = async (text) => (await one("select search_words($1) as w", [text])).w;
  assert.deepEqual(await words("Côte d'Ivoire x"), ["cote", "ivoire"]);
  assert.deepEqual(await words("niger NIGER Niger"), ["niger"]);
  assert.deepEqual(await words("a'); drop table entries; --"), ["drop", "table", "entries"]);
  assert.deepEqual(await words("one two three four five six seven eight nine"), [
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
  ]);
  assert.deepEqual(await words("x !"), []);
  assert.equal(
    (await one("select fold_text('Łódź Đakovo Øresund Diyarbakır') as t")).t,
    "lodz dakovo oresund diyarbakir",
  );
});

test("html_plain_text: odd entities and markup never raise", async () => {
  const text = async (html) => (await one("select html_plain_text($1) as t", [html])).t;
  assert.equal(
    await text("&#0; &#55296; &#9999999; &#x110000; &bogus;"),
    "&#0; &#55296; &#9999999; &#x110000; &bogus;",
  );
  assert.equal(await text("&#x2019;&#8217;&rsquo;&amp;lt;"), "’’’&lt;");
  assert.equal(await text("a<br>b</p>c<b>d</b>e <scr<b>ipt>x"), "a b cde x");
  assert.equal(await text("1 &lt; 2"), "1 < 2");
  assert.equal(await text(null), "");
  assert.equal(await text("  many\n\n  spaces&nbsp;here "), "many spaces here");
});

// ---------------------------------------------------------------------------
// search(): topics found by their chapters
// ---------------------------------------------------------------------------

test("search(): rows found before keep their rank and order; chapter matches are added", async () => {
  const after = await snapshotSearches();
  for (const text of SEARCHES) {
    for (const who of ["owner", "anon"]) {
      assert.ok(before_[text][who].length < 40, `"${text}" hits the limit; pick a narrower query`);
      const old = new Set(before_[text][who].map((row) => row.id));
      const kept = after[text][who].filter((row) => old.has(row.id));
      assert.deepEqual(kept, before_[text][who], `search("${text}") changed for ${who}`);
      // Anything new is a published topic found through a chapter.
      for (const row of after[text][who].filter((row) => !old.has(row.id))) {
        assert.equal(row.kind, "news", `${text}: ${row.id}`);
        assert.match(row.url, /^\/entry\//, `${text}: ${row.id}`);
      }
    }
  }

  const glacier = after.glacier.anon.map((row) => row.id);
  assert.ok(glacier.includes("news:zz-sahel"), "a topic is found by a chapter");
  assert.ok(glacier.includes("news:zz-glacier-news"), "own text still found");
  assert.ok(!glacier.includes("news:zz-draft-topic"), "drafts never show");
  assert.ok(!before_.glacier.anon.some((row) => row.id === "news:zz-sahel"));
  assert.ok(
    after.cote.anon.some((row) => row.id === "news:zz-smuggling"),
    "folded chapter match",
  );

  // A chapter-only match ranks at half the chapter's ts_rank.
  const sahel = after.glacier.anon.find((row) => row.id === "news:zz-sahel");
  const chapterRank = await one(
    `select max(ts_rank(c.search, prefix_tsquery(array['glacier'])))::real as r
     from entry_chapters c join entries e on e.id = c.entry_id where e.slug = 'zz-sahel'`,
  );
  assert.ok(Math.abs(sahel.rank - chapterRank.r / 2) < 1e-6, `${sahel.rank} vs ${chapterRank.r}`);
});

test("search(): the default limit and the bounds of p_limit still apply", async () => {
  const count = async (sql) => (await one(`select count(*)::int as n from ${sql}`)).n;
  assert.ok((await count("search('a')")) <= 12);
  assert.ok((await count("search('a', 0)")) <= 1);
  assert.ok((await count("search('a', 1000)")) <= 40);
  await asAnon(() => q("select * from search('a''); drop table entries; --', 10)"));
});
