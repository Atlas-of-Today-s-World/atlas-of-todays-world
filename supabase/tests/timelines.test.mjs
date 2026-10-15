import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

/**
 * Timelines of regions, global issues, countries and topics (migration
 * 20261015000050_timelines): exactly one owner per event, rich text and a
 * checked list of sources, the title / subtitle per owner, who may save a
 * timeline through replace_timeline() or write its rows directly, and who
 * reads a topic's events. The seed is loaded before the migration, so the
 * new constraints are also tried on its rows.
 *
 * Run: npm run test:db
 */

const here = dirname(fileURLToPath(import.meta.url));
const migrations = join(here, "..", "migrations");
const FIRST_NEW = "20261015000050";
const db = new PGlite();

const id = {
  admin: "00000000-0000-4000-8000-000000001a01",
  editor: "00000000-0000-4000-8000-000000001a02",
  dataEditor: "00000000-0000-4000-8000-000000001a03",
  pubA: "00000000-0000-4000-8000-000000001a04",
  pubB: "00000000-0000-4000-8000-000000001a05",
  reader: "00000000-0000-4000-8000-000000001a06",
  noDelete: "00000000-0000-4000-8000-000000001a07",
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

/** One write under the owner's role, undone afterwards (CHECK tests). */
async function rolledBack(sql, params = []) {
  await q("begin");
  try {
    return await q(sql, params);
  } finally {
    await q("rollback");
  }
}

const event = (title, extra = {}) => ({
  date_label: "1991",
  title,
  body: `${title} text`,
  body_html: `<p>${title} text</p>`,
  sources: [{ title: "Britannica", url: "https://www.britannica.com/" }],
  ...extra,
});

const save = (kind, key, events, title = "", subtitle = "") =>
  q("select replace_timeline($1, $2, $3, $4, $5::jsonb)", [
    kind,
    key,
    title,
    subtitle,
    JSON.stringify(events),
  ]);

const titles = async (column, value) =>
  (
    await q(`select title from timeline_events where ${column} = $1 order by position`, [value])
  ).map((row) => row.title);

let draftA; // pubA's draft topic
let draftB; // pubB's draft topic
let published; // a published topic (pubA's)
let news; // a news article (not a topic)

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
  await apply(files.filter((f) => f >= FIRST_NEW));

  // Edits every article's texts but may not delete anything.
  await db.exec(`
    insert into roles (id, name, news_scope) values ('no-delete', 'No delete', 'all');
    insert into role_permissions (role_id, section, actions) values ('no-delete', 'news', 'vce');
  `);
  const people = [
    [id.admin, "admin", "staff"],
    [id.editor, "content-editor", "staff"],
    [id.dataEditor, "data-editor", "staff"],
    [id.pubA, "publisher", "staff"],
    [id.pubB, "publisher", "staff"],
    [id.reader, "reader", "reader"],
    [id.noDelete, "no-delete", "staff"],
  ];
  for (const [uid, role, kind] of people) {
    await q("insert into auth.users (id, email) values ($1, $2)", [
      uid,
      `${uid.slice(-4)}@atlasoftodaysworld.org`,
    ]);
    await q("update profiles set role_id = $2, kind = $3, status = 'active' where id = $1", [
      uid,
      role,
      kind,
    ]);
  }
  const entry = async (slug, kind, owner, status) =>
    (
      await one(
        `insert into entries (slug, kind, title, summary, category, owner_id, status)
         values ($1, $2, $1, 'Summary', 'Society', $3, $4) returning id`,
        [slug, kind, owner, status],
      )
    ).id;
  draftA = await entry("timeline-draft-a", "entry", id.pubA, "draft");
  draftB = await entry("timeline-draft-b", "entry", id.pubB, "draft");
  published = await entry("timeline-published", "entry", id.pubA, "published");
  news = await entry("timeline-news", "news", id.pubA, "draft");
});

// ---------------------------------------------------------------------------
// Shape of the data
// ---------------------------------------------------------------------------

test("timelines: the test roles hold the rights the tests assume", async () => {
  const has = (user, section, action) =>
    as(user, async () => (await one("select has_perm($1, $2) as ok", [section, action])).ok);
  assert.equal(await has(id.editor, "news", "d"), true);
  assert.equal(await has(id.editor, "regions", "e"), false);
  assert.equal(await has(id.dataEditor, "regions", "e"), true);
  assert.equal(await has(id.dataEditor, "regions", "d"), false);
  assert.equal(await has(id.dataEditor, "news", "e"), false);
  assert.equal(await has(id.noDelete, "news", "e"), true);
  assert.equal(await has(id.noDelete, "news", "d"), false);
});

test("timelines: the seed's events keep their owner and gain empty rich text and sources", async () => {
  const row = await one(
    `select count(*)::int as n, bool_and(body_html = '') as html, bool_and(sources = '[]') as sources
       from timeline_events`,
  );
  assert.ok(row.n > 0);
  assert.equal(row.html, true);
  assert.equal(row.sources, true);
});

test("timelines: an event has exactly one owner of the four", async () => {
  await refused(
    rolledBack(
      `insert into timeline_events (region_slug, country_iso3, date_label, title)
       values ('middle-east-north-africa', 'EGY', '1991', 'Two owners')`,
    ),
    /timeline_events_one_owner/,
  );
  await refused(
    rolledBack(`insert into timeline_events (date_label, title) values ('1991', 'No owner')`),
    /timeline_events_one_owner/,
  );
  for (const [column, value] of [
    ["region_slug", "middle-east-north-africa"],
    ["special_slug", "russia-ukraine-war"],
    ["country_iso3", "EGY"],
    ["entry_id", draftA],
  ]) {
    const rows = await rolledBack(
      `insert into timeline_events (${column}, date_label, title) values ($1, '1991', 'One') returning id`,
      [value],
    );
    assert.equal(rows.length, 1, column);
  }
});

test("timelines: only a topic has a timeline, not a news article", async () => {
  await refused(
    rolledBack(
      `insert into timeline_events (entry_id, date_label, title) values ($1, '1991', 'News')`,
      [news],
    ),
    /Only a topic has a timeline/,
  );
});

test("timelines: sources are a list of {title, url} with https links", async () => {
  const insert = (sources) =>
    rolledBack(
      `insert into timeline_events (country_iso3, date_label, title, sources)
       values ('EGY', '1991', 'Sources', $1::jsonb) returning id`,
      [JSON.stringify(sources)],
    );
  assert.equal((await insert([])).length, 1);
  assert.equal((await insert([{ title: "UN", url: "https://www.un.org/en/a?b=c#d" }])).length, 1);
  const bad = [
    { title: "UN", url: "http://www.un.org/" },
    { title: "UN", url: "javascript:alert(1)" },
    { title: "UN", url: "https://www.un.org/ x" },
    { title: " ", url: "https://www.un.org/" },
    { title: "x".repeat(301), url: "https://www.un.org/" },
    { title: "UN", url: `https://www.un.org/${"a".repeat(1000)}` },
    { title: "UN", url: "https://www.un.org/", extra: true },
    { title: "UN" },
    { title: 1, url: "https://www.un.org/" },
    "https://www.un.org/",
  ];
  for (const source of bad) {
    await refused(insert([source]), /timeline_events_sources_valid/);
  }
  await refused(
    insert(Array.from({ length: 21 }, () => ({ title: "UN", url: "https://www.un.org/" }))),
    /timeline_events_sources_valid/,
  );
  await refused(
    rolledBack(
      `insert into timeline_events (country_iso3, date_label, title, sources)
       values ('EGY', '1991', 'Sources', '{"title":"UN"}'::jsonb)`,
    ),
    /timeline_events_sources_valid/,
  );
});

test("timelines: rich text and the headings have the form limits", async () => {
  const html = (length) =>
    rolledBack(
      `insert into timeline_events (country_iso3, date_label, title, body_html)
       values ('EGY', '1991', 'Long', $1) returning id`,
      ["x".repeat(length)],
    );
  assert.equal((await html(20000)).length, 1);
  await refused(html(20001), /timeline_events_body_html_len/);
  for (const table of ["countries", "entries"]) {
    const title = await refused(
      rolledBack(`update ${table} set timeline_title = $1`, ["x".repeat(121)]),
    );
    assert.ok(title.includes(`${table}_timeline_title_len`), title);
    const subtitle = await refused(
      rolledBack(`update ${table} set timeline_subtitle = $1`, ["x".repeat(301)]),
    );
    assert.ok(subtitle.includes(`${table}_timeline_subtitle_len`), subtitle);
  }
});

// ---------------------------------------------------------------------------
// replace_timeline(): who may save which timeline
// ---------------------------------------------------------------------------

test("timelines: an article editor saves a region's timeline with its heading", async () => {
  await as(id.editor, () =>
    save(
      "region",
      "middle-east-north-africa",
      [event("First"), event("Second")],
      " Historical Context of the Region ",
      "An overview of the key events.",
    ),
  );
  assert.deepEqual(await titles("region_slug", "middle-east-north-africa"), ["First", "Second"]);
  const region = await one(
    "select timeline_title, timeline_subtitle from regions where slug = 'middle-east-north-africa'",
  );
  assert.equal(region.timeline_title, "Historical Context of the Region");
  assert.equal(region.timeline_subtitle, "An overview of the key events.");
  const stored = await one(
    `select body, body_html, sources from timeline_events
      where region_slug = 'middle-east-north-africa' and position = 0`,
  );
  assert.equal(stored.body, "First text");
  assert.equal(stored.body_html, "<p>First text</p>");
  assert.deepEqual(stored.sources, [{ title: "Britannica", url: "https://www.britannica.com/" }]);

  // Saving again replaces the list (reordered, one removed) and clears the heading.
  await as(id.editor, () => save("region", "middle-east-north-africa", [event("Second")]));
  assert.deepEqual(await titles("region_slug", "middle-east-north-africa"), ["Second"]);
  const cleared = await one(
    "select timeline_title, timeline_subtitle from regions where slug = 'middle-east-north-africa'",
  );
  assert.equal(cleared.timeline_title, null);
  assert.equal(cleared.timeline_subtitle, null);
});

test("timelines: a global issue's timeline follows the same rule as a region's", async () => {
  await as(id.editor, () =>
    save("issue", "russia-ukraine-war", [event("Independence")], "Historical Context of the War"),
  );
  assert.deepEqual(await titles("special_slug", "russia-ukraine-war"), ["Independence"]);
  assert.equal(
    (await one("select timeline_title from special_regions where slug = 'russia-ukraine-war'"))
      .timeline_title,
    "Historical Context of the War",
  );
  // The data editor edits global issues but not their texts.
  await as(id.dataEditor, () =>
    refused(save("issue", "russia-ukraine-war", []), /You may not edit this timeline/),
  );
});

test("timelines: who edits the country profile saves the country's timeline", async () => {
  await as(id.dataEditor, () => save("country", "EGY", [event("Revolution")], "Egypt in time"));
  // Saving again removes the old events with "e" alone (no "d" in the role).
  await as(id.dataEditor, () =>
    save("country", "EGY", [event("Revolution"), event("Elections")], "Egypt in time"),
  );
  assert.deepEqual(await titles("country_iso3", "EGY"), ["Revolution", "Elections"]);
  assert.equal(
    (await one("select timeline_title from countries where iso3 = 'EGY'")).timeline_title,
    "Egypt in time",
  );
  // Article editors don't edit country profiles.
  await as(id.editor, () => refused(save("country", "EGY", []), /You may not edit this timeline/));
});

test("timelines: a topic's timeline is written by who may write the topic's parts", async () => {
  // A publisher on their own draft, with its heading.
  await as(id.pubA, () => save("topic", draftA, [event("Draft event")], "Topic history"));
  assert.deepEqual(await titles("entry_id", draftA), ["Draft event"]);
  assert.equal(
    (await one("select timeline_title from entries where id = $1", [draftA])).timeline_title,
    "Topic history",
  );
  // Not on someone else's draft, nor on their own published topic (that needs an approver).
  await as(id.pubA, () => refused(save("topic", draftB, []), /You may not edit this timeline/));
  await as(id.pubA, () =>
    refused(save("topic", published, [event("Late")]), /You may not edit this timeline/),
  );
  // The content editor approves every entry, so it writes the published one.
  await as(id.editor, () => save("topic", published, [event("Published event")]));
  assert.deepEqual(await titles("entry_id", published), ["Published event"]);
});

test("timelines: an unknown owner, a news article or a bad kind is refused", async () => {
  await as(id.admin, async () => {
    await refused(save("region", "atlantis", []), /Unknown timeline/);
    await refused(save("country", "XXX", []), /Unknown timeline/);
    await refused(save("topic", news, []), /Unknown timeline/);
    await refused(save("topic", "not-a-uuid", []), /Unknown timeline/);
    await refused(save("planet", "earth", []), /Unknown timeline/);
    await refused(
      q("select replace_timeline('country', 'EGY', '', '', '{}'::jsonb)"),
      /at most 60 events/,
    );
    await refused(
      save(
        "country",
        "EGY",
        Array.from({ length: 61 }, (_, index) => event(`E${index}`)),
      ),
      /at most 60 events/,
    );
    // A bad source stops the whole save; the timeline stays as it was.
    const before = await titles("country_iso3", "EGY");
    await refused(
      save("country", "EGY", [event("Bad", { sources: [{ title: "x", url: "http://x" }] })]),
      /timeline_events_sources_valid/,
    );
    assert.deepEqual(await titles("country_iso3", "EGY"), before);
  });
});

test("timelines: without the right to delete, a filled timeline can't be replaced", async () => {
  await as(id.noDelete, async () => {
    await refused(
      save("region", "middle-east-north-africa", [event("Mine")]),
      /You may not remove timeline events/,
    );
    // An empty one can be filled.
    await save("region", "east-asia", [event("East")]);
  });
  assert.deepEqual(await titles("region_slug", "east-asia"), ["East"]);
});

test("timelines: anon, readers and unrelated staff can't call replace_timeline", async () => {
  await as(null, () =>
    refused(save("country", "EGY", []), /permission denied for function replace_timeline/),
  );
  await as(id.reader, () => refused(save("country", "EGY", []), /You may not edit this timeline/));
  await as(id.pubB, () =>
    refused(save("region", "east-asia", []), /You may not edit this timeline/),
  );
});

// ---------------------------------------------------------------------------
// Direct writes follow the same rules (the row policies)
// ---------------------------------------------------------------------------

test("timelines: row policies — country by regions 'e', region by article editors", async () => {
  await as(id.dataEditor, async () => {
    const [row] = await q(
      `insert into timeline_events (country_iso3, date_label, title) values ('TUN', '2011', 'Direct')
       returning id`,
    );
    assert.ok(row.id);
    await refused(
      q(
        `insert into timeline_events (region_slug, date_label, title)
         values ('east-asia', '2011', 'Direct')`,
      ),
      /row-level security/,
    );
    const removed = await q("delete from timeline_events where country_iso3 = 'TUN' returning id");
    assert.equal(removed.length, 1);
  });
  await as(id.pubA, async () => {
    await refused(
      q(`insert into timeline_events (entry_id, date_label, title) values ($1, '2011', 'Direct')`, [
        draftB,
      ]),
      /row-level security/,
    );
    const [row] = await q(
      `insert into timeline_events (entry_id, date_label, title) values ($1, '2011', 'Own')
       returning id`,
      [draftA],
    );
    assert.ok(row.id);
  });
});

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

test("timelines: anon reads places' events and a topic's only once it is published", async () => {
  await as(null, async () => {
    assert.ok((await titles("region_slug", "middle-east-north-africa")).length > 0);
    assert.ok((await titles("country_iso3", "EGY")).length > 0);
    assert.deepEqual(await titles("entry_id", published), ["Published event"]);
    assert.deepEqual(await titles("entry_id", draftA), []);
    // The topic's heading is a public column.
    const row = await one("select timeline_title, timeline_subtitle from entries where id = $1", [
      published,
    ]);
    assert.ok(row);
  });
});

test("timelines: signed in, a draft topic's events are its editors' and the editorial team's", async () => {
  await as(id.reader, async () => {
    assert.deepEqual(await titles("entry_id", draftA), []);
    assert.deepEqual(await titles("entry_id", published), ["Published event"]);
    assert.ok((await titles("country_iso3", "EGY")).length > 0);
  });
  await as(id.pubB, async () => assert.deepEqual(await titles("entry_id", draftA), []));
  await as(id.pubA, async () => assert.ok((await titles("entry_id", draftA)).length > 0));
  await as(id.editor, async () => assert.ok((await titles("entry_id", draftA)).length > 0));
});

test("timelines: portrait() returns each event's rich text and sources", async () => {
  await as(id.editor, () =>
    save("region", "middle-east-north-africa", [
      event("Rich", { body_html: "<p><strong>Rich</strong></p>" }),
    ]),
  );
  const portrait = await as(
    null,
    async () => (await one("select portrait('region', 'middle-east-north-africa') as p")).p,
  );
  assert.deepEqual(portrait.timeline, [
    {
      date: "1991",
      title: "Rich",
      text: "Rich text",
      html: "<p><strong>Rich</strong></p>",
      sources: [{ title: "Britannica", url: "https://www.britannica.com/" }],
    },
  ]);
});
