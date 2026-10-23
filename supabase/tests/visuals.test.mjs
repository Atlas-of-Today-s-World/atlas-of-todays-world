import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

/**
 * Maps & charts of regions, global issues, topics and subtopics (migration
 * 20261015000100_visuals): one owner per visual, the shape of each kind and
 * the allowed embed URLs, who writes which owner's visuals (incl. a pending
 * topic frozen for its author), who reads them, the order (move_visual), a
 * subtopic's visuals surviving its topic's save, and the copy of the old
 * visual_embeds rows. The seed (and two extra old rows) is loaded before the
 * migration, so the copy runs on real data.
 *
 * Run: npm run test:db
 */

const here = dirname(fileURLToPath(import.meta.url));
const migrations = join(here, "..", "migrations");
const FIRST_NEW = "20261015000100";
const db = new PGlite();

const id = {
  admin: "00000000-0000-4000-8000-000000002b01",
  editor: "00000000-0000-4000-8000-000000002b02",
  dataEditor: "00000000-0000-4000-8000-000000002b03",
  pubA: "00000000-0000-4000-8000-000000002b04",
  pubB: "00000000-0000-4000-8000-000000002b05",
  reader: "00000000-0000-4000-8000-000000002b06",
  noDelete: "00000000-0000-4000-8000-000000002b07",
};

const CHART = "https://datawrapper.dwcdn.net/aB3dE/2/";
const OLD_CHART_ID = "00000000-0000-4000-8000-00000000c0a1";
const OLD_BROKEN_ID = "00000000-0000-4000-8000-00000000c0a2";

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

/** Inserts an embed for an owner; returns its id. */
const addEmbed = async (owner, key, title, extra = {}) => {
  const column = {
    region: "region_slug",
    issue: "special_slug",
    entry: "entry_id",
    chapter: "chapter_id",
  }[owner];
  const row = {
    kind: "embed",
    provider: "datawrapper",
    embed_url: CHART,
    ...extra,
  };
  const names = Object.keys(row);
  const values = Object.values(row);
  return (
    await one(
      `insert into visuals (owner_kind, ${column}, title, ${names.join(", ")})
       values ($1, $2, $3, ${names.map((_, index) => `$${index + 4}`).join(", ")}) returning id`,
      [owner, key, title, ...values],
    )
  ).id;
};

const titles = async (column, value) =>
  (await q(`select title from visuals where ${column} = $1 order by position, id`, [value])).map(
    (row) => row.title,
  );

let draftA; // pubA's draft topic
let draftB; // pubB's draft topic
let pendingA; // pubA's topic waiting for approval
let published; // a published topic (pubA's)
let news; // a news article (not a topic)
let chapterPublished; // a subtopic of the published topic
let chapterDraft; // a subtopic of pubA's draft

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
  // Old rows the copy must handle: a Datawrapper chart on a global issue, and
  // an image whose URL the new checks refuse (a space).
  await q(
    `insert into visual_embeds (id, special_slug, provider, position, title, caption, url)
     values ($1, 'russia-ukraine-war', 'datawrapper', 0, 'Refugees', 'UNHCR', $2),
            ($3, 'russia-ukraine-war', 'image', 1, 'Broken', '', 'https://example.org/a map.png')`,
    [OLD_CHART_ID, CHART, OLD_BROKEN_ID],
  );
  await apply(files.filter((f) => f >= FIRST_NEW));

  // Edits every article's texts but may not delete anything.
  await db.exec(`
    insert into roles (id, name, news_scope) values ('no-delete-v', 'No delete', 'all');
    insert into role_permissions (role_id, section, actions) values ('no-delete-v', 'news', 'vce');
  `);
  const people = [
    [id.admin, "admin", "staff"],
    [id.editor, "content-editor", "staff"],
    [id.dataEditor, "data-editor", "staff"],
    [id.pubA, "publisher", "staff"],
    [id.pubB, "publisher", "staff"],
    [id.reader, "reader", "reader"],
    [id.noDelete, "no-delete-v", "staff"],
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
  draftA = await entry("visuals-draft-a", "entry", id.pubA, "draft");
  draftB = await entry("visuals-draft-b", "entry", id.pubB, "draft");
  pendingA = await entry("visuals-pending-a", "entry", id.pubA, "pending");
  published = await entry("visuals-published", "entry", id.pubA, "published");
  news = await entry("visuals-news", "news", id.pubA, "draft");
  const chapter = async (entryId, title) =>
    (
      await one(
        `insert into entry_chapters (entry_id, position, title) values ($1, 0, $2) returning id`,
        [entryId, title],
      )
    ).id;
  chapterPublished = await chapter(published, "Published subtopic");
  chapterDraft = await chapter(draftA, "Draft subtopic");
});

// ---------------------------------------------------------------------------
// The copy of visual_embeds
// ---------------------------------------------------------------------------

test("visuals: the old rows are copied — charts as embeds, the rest as images", async () => {
  const chart = await one("select * from visuals where id = $1", [OLD_CHART_ID]);
  assert.equal(chart.owner_kind, "issue");
  assert.equal(chart.special_slug, "russia-ukraine-war");
  assert.equal(chart.kind, "embed");
  assert.equal(chart.provider, "datawrapper");
  assert.equal(chart.embed_url, CHART);
  assert.equal(chart.image_url, null);
  assert.equal(chart.caption, "UNHCR");

  // The seed's image (one since 02ffb54 dropped the placeholder map) keeps its
  // region, order and URL.
  const seeded = await q(
    `select v.kind, v.title, v.image_url, v.position, e.url, e.position as old_position
       from visual_embeds e join visuals v on v.id = e.id
      where e.region_slug = 'eastern-europe-central-asia' order by e.position`,
  );
  assert.equal(seeded.length, 1);
  for (const row of seeded) {
    assert.equal(row.kind, "image");
    assert.equal(row.image_url, row.url);
    assert.equal(row.position, row.old_position);
  }
  // Only a row the new checks refuse stays behind (in visual_embeds).
  const missing = await q(
    "select e.id from visual_embeds e where not exists (select 1 from visuals v where v.id = e.id)",
  );
  assert.deepEqual(
    missing.map((row) => row.id),
    [OLD_BROKEN_ID],
  );
});

test("visuals: portrait() reads the new table, with the keys the old app needs", async () => {
  const portrait = await as(
    null,
    async () => (await one("select portrait('issue', 'russia-ukraine-war') as p")).p,
  );
  assert.deepEqual(
    portrait.visuals.map((v) => [v.kind, v.provider, v.embed_url, v.image]),
    [["embed", "datawrapper", CHART, CHART]],
  );
  const region = await as(
    null,
    async () => (await one("select portrait('region', 'eastern-europe-central-asia') as p")).p,
  );
  assert.equal(region.visuals.length, 1);
  assert.ok(region.visuals.every((v) => v.kind === "image" && v.image === v.image_url));
  assert.ok(region.visuals.every((v) => v.provider === null));
});

// ---------------------------------------------------------------------------
// Shape of the data
// ---------------------------------------------------------------------------

test("visuals: exactly one owner, the one owner_kind names", async () => {
  const insert = (sql, params) => rolledBack(sql, params);
  await refused(
    insert(
      `insert into visuals (owner_kind, region_slug, special_slug, kind, title, image_url)
       values ('region', 'east-asia', 'russia-ukraine-war', 'image', 'Two', 'https://x.org/a.png')`,
    ),
    /visuals_one_owner/,
  );
  await refused(
    insert(
      `insert into visuals (owner_kind, kind, title, image_url)
       values ('region', 'image', 'None', 'https://x.org/a.png')`,
    ),
    /visuals_one_owner/,
  );
  await refused(
    insert(
      `insert into visuals (owner_kind, special_slug, kind, title, image_url)
       values ('region', 'russia-ukraine-war', 'image', 'Mismatch', 'https://x.org/a.png')`,
    ),
    /visuals_one_owner/,
  );
  await refused(
    insert(
      `insert into visuals (owner_kind, region_slug, kind, title, image_url)
       values ('country', 'east-asia', 'image', 'Kind', 'https://x.org/a.png')`,
    ),
    /visuals_owner_kind_check|visuals_one_owner/,
  );
  for (const [owner, column, value] of [
    ["region", "region_slug", "east-asia"],
    ["issue", "special_slug", "russia-ukraine-war"],
    ["entry", "entry_id", draftA],
    ["chapter", "chapter_id", chapterDraft],
  ]) {
    const rows = await insert(
      `insert into visuals (owner_kind, ${column}, kind, title, image_url)
       values ($1, $2, 'image', 'One', 'https://x.org/a.png') returning id`,
      [owner, value],
    );
    assert.equal(rows.length, 1, owner);
  }
});

test("visuals: a news article has none, only a topic", async () => {
  await refused(
    rolledBack(
      `insert into visuals (owner_kind, entry_id, kind, title, image_url)
       values ('entry', $1, 'image', 'News', 'https://x.org/a.png')`,
      [news],
    ),
    /Only a topic has maps and charts/,
  );
});

test("visuals: each kind carries its own content and nothing else", async () => {
  const insert = (fields) => {
    const names = Object.keys(fields);
    return rolledBack(
      `insert into visuals (owner_kind, region_slug, title, ${names.join(", ")})
       values ('region', 'east-asia', 'Shape', ${names.map((_, i) => `$${i + 1}`).join(", ")})
       returning id`,
      Object.values(fields),
    );
  };
  const ok = [
    { kind: "embed", provider: "datawrapper", embed_url: CHART },
    { kind: "image", image_url: "https://example.org/map.png" },
    { kind: "map", map_spec: JSON.stringify({ version: 1, layers: [] }) },
    { kind: "html", html: "<div>Chart</div><script>draw()</script>" },
  ];
  for (const fields of ok) assert.equal((await insert(fields)).length, 1, fields.kind);
  const bad = [
    { kind: "embed", provider: "datawrapper" },
    { kind: "embed", embed_url: CHART },
    { kind: "embed", provider: "datawrapper", embed_url: CHART, image_url: "https://x.org/a" },
    { kind: "image" },
    { kind: "image", image_url: "https://x.org/a", provider: "owid" },
    { kind: "map" },
    { kind: "map", map_spec: "{}", image_url: "https://x.org/a" },
    { kind: "chart", image_url: "https://x.org/a" },
    { kind: "html" },
    { kind: "html", html: "  " },
    { kind: "html", html: "<p>x</p>", image_url: "https://x.org/a" },
    { kind: "image", image_url: "https://x.org/a", html: "<p>x</p>" },
  ];
  for (const fields of bad) {
    await refused(insert(fields), /visuals_kind_fields|visuals_kind_check|visuals_embed_url_check/);
  }
  // A map spec is a JSON object of at most 200 kB.
  await refused(insert({ kind: "map", map_spec: "[1, 2]" }), /visuals_map_spec_check/);
  await refused(insert({ kind: "map", map_spec: '"text"' }), /visuals_map_spec_check/);
  await refused(
    insert({ kind: "map", map_spec: JSON.stringify({ blob: "x".repeat(204800) }) }),
    /visuals_map_spec_check/,
  );
  // Custom code (20261020000100): at most 512 kB.
  assert.equal((await insert({ kind: "html", html: "x".repeat(524288) })).length, 1);
  await refused(insert({ kind: "html", html: "x".repeat(524289) }), /visuals_html_len/);
});

test("visuals: embed URLs only in each provider's canonical shape", async () => {
  const insert = (provider, embed_url) =>
    rolledBack(
      `insert into visuals (owner_kind, region_slug, title, kind, provider, embed_url)
       values ('region', 'east-asia', 'Embed', 'embed', $1, $2) returning id`,
      [provider, embed_url],
    );
  const ok = [
    ["datawrapper", "https://datawrapper.dwcdn.net/aB3dE/2/"],
    ["datawrapper", "https://datawrapper.dwcdn.net/aB3dE/"],
    ["flourish", "https://flo.uri.sh/visualisation/1810417/embed"],
    ["flourish", "https://flo.uri.sh/story/123456/embed"],
    ["owid", "https://ourworldindata.org/grapher/life-expectancy"],
    ["owid", "https://ourworldindata.org/grapher/life-expectancy?tab=chart&country=~CZE"],
    ["worldbank", "https://data.worldbank.org/share/widget?indicators=SP.POP.TOTL&locations=CZ"],
  ];
  for (const [provider, url] of ok) assert.equal((await insert(provider, url)).length, 1, url);
  const bad = [
    ["datawrapper", "https://datawrapper.dwcdn.net.evil.com/aB3dE/2/"],
    ["datawrapper", "https://datawrapper.dwcdn.net/aB3dE/2/?x=1"],
    ["datawrapper", `https://datawrapper.dwcdn.net/aB3dE/2/"><script>alert(1)</script>`],
    ["datawrapper", "https://flo.uri.sh/visualisation/1810417/embed"],
    ["flourish", "https://public.flourish.studio/visualisation/1810417/"],
    ["flourish", "https://flo.uri.sh/visualisation/1810417/embed?auto=1"],
    ["owid", "https://ourworldindata.org/explorers/co2"],
    ["owid", "https://ourworldindata.org/grapher/life-expectancy#x"],
    ["owid", 'https://ourworldindata.org/grapher/life-expectancy?x="y"'],
    ["owid", "http://ourworldindata.org/grapher/life-expectancy"],
    ["worldbank", "https://data.worldbank.org/indicator/SP.POP.TOTL"],
    ["worldbank", "https://datatopics.worldbank.org/x"],
    ["worldbank", "https://data.worldbank.org/share/widget?a=1 b"],
    ["youtube", "https://www.youtube.com/embed/x"],
    ["owid", "javascript:alert(1)"],
    ["owid", "data:text/html,<script>alert(1)</script>"],
  ];
  for (const [provider, url] of bad) {
    await refused(insert(provider, url), /visuals_embed_url_check|visuals_provider_check/);
  }
  await refused(insert("owid", `https://ourworldindata.org/grapher/${"a".repeat(1000)}`));
});

test("visuals: text, links and height have the form limits", async () => {
  const insert = (fields) => {
    const names = Object.keys(fields);
    return rolledBack(
      `insert into visuals (owner_kind, region_slug, kind, image_url, ${names.join(", ")})
       values ('region', 'east-asia', 'image', 'https://x.org/a.png',
               ${names.map((_, i) => `$${i + 1}`).join(", ")}) returning id`,
      Object.values(fields),
    );
  };
  assert.equal(
    (
      await insert({
        title: "x".repeat(200),
        caption: "x".repeat(600),
        source_label: "x".repeat(120),
        source_url: "https://www.un.org/",
        height: 1600,
      })
    ).length,
    1,
  );
  await refused(insert({ title: "x".repeat(201) }), /visuals_title_len/);
  await refused(insert({ title: "   " }), /visuals_title_len/);
  await refused(insert({ title: "T", caption: "x".repeat(601) }), /visuals_caption_len/);
  await refused(insert({ title: "T", source_label: "x".repeat(121) }), /visuals_source_label_len/);
  await refused(insert({ title: "T", source_url: "http://www.un.org/" }), /visuals_source_url/);
  await refused(insert({ title: "T", source_url: "javascript:alert(1)" }), /visuals_source_url/);
  await refused(insert({ title: "T", height: 199 }), /visuals_height_range/);
  await refused(insert({ title: "T", height: 1601 }), /visuals_height_range/);
  await refused(
    rolledBack(
      `insert into visuals (owner_kind, region_slug, kind, title, image_url)
       values ('region', 'east-asia', 'image', 'T', 'http://x.org/a.png')`,
    ),
    /visuals_image_url_check/,
  );
});

// ---------------------------------------------------------------------------
// Who writes
// ---------------------------------------------------------------------------

test("visuals: the test roles hold the rights the tests assume", async () => {
  const has = (user, section, action) =>
    as(user, async () => (await one("select has_perm($1, $2) as ok", [section, action])).ok);
  assert.equal(await has(id.editor, "news", "d"), true);
  assert.equal(await has(id.editor, "regions", "e"), false);
  assert.equal(await has(id.editor, "specials", "e"), false);
  assert.equal(await has(id.dataEditor, "regions", "e"), true);
  assert.equal(await has(id.dataEditor, "specials", "e"), true);
  assert.equal(await has(id.dataEditor, "news", "e"), false);
  assert.equal(await has(id.pubA, "regions", "e"), false);
  assert.equal(await has(id.noDelete, "news", "d"), false);
});

test("visuals: regions — regions 'e' or an article editor over all articles", async () => {
  for (const user of [id.dataEditor, id.editor]) {
    const added = await as(user, () => addEmbed("region", "east-asia", `By ${user.slice(-2)}`));
    await as(user, async () => {
      const changed = await q("update visuals set title = 'Renamed' where id = $1 returning id", [
        added,
      ]);
      assert.equal(changed.length, 1);
      const removed = await q("delete from visuals where id = $1 returning id", [added]);
      assert.equal(removed.length, 1);
    });
  }
  // A publisher edits own articles only; a reader nothing.
  for (const user of [id.pubA, id.reader]) {
    await as(user, () => refused(addEmbed("region", "east-asia", "No"), /row-level security/));
  }
  // Without "d" in news, an article editor adds but doesn't remove.
  const kept = await as(id.noDelete, () => addEmbed("region", "east-asia", "Kept"));
  await as(id.noDelete, async () => {
    assert.equal((await q("delete from visuals where id = $1 returning id", [kept])).length, 0);
  });
  assert.deepEqual(await titles("region_slug", "east-asia"), ["Kept"]);
});

test("visuals: global issues — specials 'e' or an article editor over all articles", async () => {
  for (const user of [id.dataEditor, id.editor]) {
    const added = await as(user, () => addEmbed("issue", "russia-ukraine-war", "Issue"));
    await as(user, async () => {
      assert.equal((await q("delete from visuals where id = $1 returning id", [added])).length, 1);
    });
  }
  await as(id.pubA, () =>
    refused(addEmbed("issue", "russia-ukraine-war", "No"), /row-level security/),
  );
});

test("visuals: a topic's and its subtopics' by who may write the topic (can_write_entry)", async () => {
  // A publisher on their own draft, the topic and a subtopic.
  const topicVisual = await as(id.pubA, () => addEmbed("entry", draftA, "Topic chart"));
  const chapterVisual = await as(id.pubA, () => addEmbed("chapter", chapterDraft, "Sub chart"));
  assert.ok(topicVisual && chapterVisual);
  // Not on someone else's draft; the data editor not on topics at all.
  await as(id.pubB, () => refused(addEmbed("entry", draftA, "No"), /row-level security/));
  await as(id.pubA, () => refused(addEmbed("entry", draftB, "No"), /row-level security/));
  await as(id.pubB, () => refused(addEmbed("chapter", chapterDraft, "No"), /row-level security/));
  await as(id.dataEditor, () => refused(addEmbed("entry", draftA, "No"), /row-level security/));
  await as(id.pubB, async () => {
    assert.equal(
      (await q("update visuals set title = 'x' where id = $1 returning id", [topicVisual])).length,
      0,
    );
    assert.equal(
      (await q("delete from visuals where id = $1 returning id", [chapterVisual])).length,
      0,
    );
  });
  // Their own published topic needs an approver; the content editor approves every entry.
  await as(id.pubA, () => refused(addEmbed("entry", published, "Late"), /row-level security/));
  await as(id.pubA, () =>
    refused(addEmbed("chapter", chapterPublished, "Late"), /row-level security/),
  );
  await as(id.editor, () => addEmbed("entry", published, "Published chart"));
  await as(id.editor, () => addEmbed("chapter", chapterPublished, "Published sub chart"));
});

test("visuals: a pending topic is frozen for its author (#183), not for an approver", async () => {
  await as(id.pubA, () => refused(addEmbed("entry", pendingA, "Frozen"), /row-level security/));
  const approved = await as(id.editor, () => addEmbed("entry", pendingA, "By approver"));
  await as(id.pubA, async () => {
    assert.equal(
      (await q("update visuals set title = 'x' where id = $1 returning id", [approved])).length,
      0,
    );
    assert.equal((await q("delete from visuals where id = $1 returning id", [approved])).length, 0);
  });
});

test("visuals: the owner of a visual can't be changed, only its content", async () => {
  const visual = await as(id.editor, () => addEmbed("region", "middle-east-north-africa", "Own"));
  await as(id.editor, async () => {
    await refused(
      q("update visuals set region_slug = 'east-asia' where id = $1", [visual]),
      /permission denied/,
    );
    await refused(
      q("update visuals set owner_kind = 'issue' where id = $1", [visual]),
      /permission denied/,
    );
  });
  // Anon writes nothing.
  await as(null, () =>
    refused(addEmbed("region", "middle-east-north-africa", "Anon"), /permission denied/),
  );
});

// ---------------------------------------------------------------------------
// Who reads
// ---------------------------------------------------------------------------

test("visuals: anon reads places' visuals and a topic's only while it is published", async () => {
  await as(null, async () => {
    assert.ok((await titles("region_slug", "eastern-europe-central-asia")).length > 0);
    assert.ok((await titles("special_slug", "russia-ukraine-war")).length > 0);
    assert.deepEqual(await titles("entry_id", published), ["Published chart"]);
    assert.deepEqual(await titles("chapter_id", chapterPublished), ["Published sub chart"]);
    assert.deepEqual(await titles("entry_id", draftA), []);
    assert.deepEqual(await titles("chapter_id", chapterDraft), []);
    assert.deepEqual(await titles("entry_id", pendingA), []);
  });
});

test("visuals: signed in, a draft topic's visuals are its editors' and the editorial team's", async () => {
  await as(id.reader, async () => {
    assert.deepEqual(await titles("entry_id", draftA), []);
    assert.deepEqual(await titles("chapter_id", chapterDraft), []);
    assert.deepEqual(await titles("entry_id", published), ["Published chart"]);
    assert.deepEqual(await titles("chapter_id", chapterPublished), ["Published sub chart"]);
  });
  await as(id.pubB, async () => assert.deepEqual(await titles("entry_id", draftA), []));
  await as(id.pubA, async () => {
    assert.deepEqual(await titles("entry_id", draftA), ["Topic chart"]);
    assert.deepEqual(await titles("chapter_id", chapterDraft), ["Sub chart"]);
  });
  await as(id.editor, async () =>
    assert.deepEqual(await titles("chapter_id", chapterDraft), ["Sub chart"]),
  );
});

test("visuals: anon reads public columns only", async () => {
  await as(null, async () => {
    await refused(q("select created_at from visuals limit 1"), /permission denied/);
    assert.ok(await one("select id, title, map_spec, html, updated_at from visuals limit 1"));
  });
});

test("visuals: a preview link shows a draft topic's and its subtopics' visuals, nothing else", async () => {
  const { token } = await as(id.pubA, () =>
    one("select create_preview_link($1, 24) as token", [draftA]),
  );
  const rows = await as(null, () =>
    q(
      "select chapter_position, title, kind, map_spec from entry_preview_visuals($1) order by title",
      [token],
    ),
  );
  assert.deepEqual(
    rows.map((row) => [row.chapter_position, row.title]),
    [
      [0, "Sub chart"],
      [null, "Topic chart"],
    ],
  );
  // Another topic's visuals never come along; a wrong or malformed token returns nothing.
  assert.equal(
    (await as(null, () => q("select 1 from entry_preview_visuals($1)", ["0".repeat(64)]))).length,
    0,
  );
  assert.equal((await as(null, () => q("select 1 from entry_preview_visuals('x')"))).length, 0);
  // An expired link shows nothing.
  await q(
    "update preview_links set created_at = now() - interval '2 days', expires_at = now() - interval '1 second' where entry_id = $1",
    [draftA],
  );
  assert.equal(
    (await as(null, () => q("select 1 from entry_preview_visuals($1)", [token]))).length,
    0,
  );
});

// ---------------------------------------------------------------------------
// Order
// ---------------------------------------------------------------------------

test("visuals: move_visual swaps a visual with its neighbour within its owner", async () => {
  const owner = "south-asia";
  const ids = [];
  for (const [index, title] of ["A", "B", "C"].entries()) {
    ids.push(await as(id.dataEditor, () => addEmbed("region", owner, title, { position: index })));
  }
  // Another owner's visuals don't take part.
  await as(id.dataEditor, () => addEmbed("region", "east-asia", "Elsewhere", { position: 1 }));
  await as(id.dataEditor, () => q("select move_visual($1, true)", [ids[2]]));
  assert.deepEqual(await titles("region_slug", owner), ["A", "C", "B"]);
  await as(id.dataEditor, () => q("select move_visual($1, false)", [ids[0]]));
  assert.deepEqual(await titles("region_slug", owner), ["C", "A", "B"]);
  // Already first: nothing happens.
  await as(id.dataEditor, () => q("select move_visual($1, true)", [ids[2]]));
  assert.deepEqual(await titles("region_slug", owner), ["C", "A", "B"]);

  // Without the right to edit the owner the order stays.
  await as(id.pubA, () =>
    refused(q("select move_visual($1, true)", [ids[1]]), /can't reorder these maps and charts/),
  );
  await as(id.pubB, async () => {
    const visual = (await one("select id from visuals where entry_id = $1", [draftA])) ?? null;
    assert.equal(visual, null);
  });
  await as(null, () =>
    refused(q("select move_visual($1, true)", [ids[1]]), /permission denied for function/),
  );
  await as(id.admin, () =>
    refused(
      q("select move_visual($1, true)", ["00000000-0000-4000-8000-000000000000"]),
      /no longer there/,
    ),
  );
  assert.deepEqual(await titles("region_slug", owner), ["C", "A", "B"]);
});

// ---------------------------------------------------------------------------
// Subtopics re-saved and removed
// ---------------------------------------------------------------------------

test("visuals: a subtopic keeps its visuals when its topic is saved, loses them when removed", async () => {
  const chapters = (list) =>
    as(id.pubA, () =>
      q("select replace_entry_parts($1, 'chapters', $2::jsonb)", [draftA, JSON.stringify(list)]),
    );
  const current = await q("select id, title from entry_chapters where entry_id = $1", [draftA]);
  assert.equal(current.length, 1);
  // Saved again with the same id (and a new subtopic next to it): the visual stays.
  await chapters([
    { id: chapterDraft, title: "Draft subtopic, edited", summary_points: [], body_html: "" },
    { title: "Second subtopic", summary_points: [], body_html: "" },
  ]);
  assert.deepEqual(await titles("chapter_id", chapterDraft), ["Sub chart"]);
  // Saved without it: the subtopic and its visuals are gone, the topic's stay.
  const second = (
    await one("select id from entry_chapters where entry_id = $1 and title = 'Second subtopic'", [
      draftA,
    ])
  ).id;
  await chapters([{ id: second, title: "Second subtopic", summary_points: [], body_html: "" }]);
  assert.equal(
    (await one("select count(*)::int as n from visuals where chapter_id = $1", [chapterDraft])).n,
    0,
  );
  assert.deepEqual(await titles("entry_id", draftA), ["Topic chart"]);
});

test("visuals: deleting a topic, region or global issue takes its visuals along", async () => {
  const topic = (
    await one(
      `insert into entries (slug, kind, title, summary, category, owner_id, status)
       values ('visuals-gone', 'entry', 'Gone', 'Summary', 'Society', $1, 'draft') returning id`,
      [id.pubA],
    )
  ).id;
  const chapter = (
    await one(
      `insert into entry_chapters (entry_id, position, title) values ($1, 0, 'Gone') returning id`,
      [topic],
    )
  ).id;
  await as(id.pubA, async () => {
    await addEmbed("entry", topic, "Topic");
    await addEmbed("chapter", chapter, "Subtopic");
  });
  await q("delete from entries where id = $1", [topic]);
  assert.equal(
    (
      await one("select count(*)::int as n from visuals where entry_id = $1 or chapter_id = $2", [
        topic,
        chapter,
      ])
    ).n,
    0,
  );

  // A renamed global issue keeps its visuals (on update cascade).
  await q(
    `insert into special_regions (slug, kind, name, fill, stroke, center_lon, center_lat)
     values ('visuals-issue', 'issue', 'Visuals issue', '#112233', '#445566', 0, 0)`,
  );
  await as(id.dataEditor, () => addEmbed("issue", "visuals-issue", "Follows"));
  await q("update special_regions set slug = 'visuals-issue-2' where slug = 'visuals-issue'");
  assert.deepEqual(await titles("special_slug", "visuals-issue-2"), ["Follows"]);
  await q("delete from special_regions where slug = 'visuals-issue-2'");
  assert.deepEqual(await titles("special_slug", "visuals-issue-2"), []);
});

test("visuals: every change is in the audit log, without the map spec", async () => {
  const visual = await as(id.dataEditor, () =>
    addEmbed("region", "east-asia", "Audited map", {
      kind: "map",
      provider: null,
      embed_url: null,
      map_spec: JSON.stringify({ secret: "big" }),
    }),
  );
  const row = await one(
    "select detail from audit_log where action = 'visuals.insert' and target = $1",
    [visual],
  );
  assert.ok(row, "insert logged");
  assert.equal(JSON.stringify(row.detail).includes("secret"), false);
});

test("visuals: custom code stays out of the audit log too", async () => {
  const visual = await as(id.dataEditor, () =>
    addEmbed("region", "east-asia", "Audited code", {
      kind: "html",
      provider: null,
      embed_url: null,
      html: "<script>secretCode()</script>",
    }),
  );
  await as(id.dataEditor, () =>
    q("update visuals set html = '<script>otherCode()</script>' where id = $1", [visual]),
  );
  const rows = await q("select detail from audit_log where target = $1", [visual]);
  assert.equal(rows.length, 2, "insert and update logged");
  assert.equal(JSON.stringify(rows).includes("Code()"), false);
});
