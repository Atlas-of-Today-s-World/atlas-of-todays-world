import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

/**
 * Search helpers and default grants (migration
 * 20261013000210_search_helpers_and_default_grants).
 *
 * The harness stops before that migration, loads the seed plus fixture topics,
 * records what the search RPCs and html_plain_text() return, then applies the
 * rest — so results are compared with the previous version on the same data.
 * supabase-stubs.sql models Supabase's default privileges, so the grants here
 * are the ones production has.
 *
 * Run: npm run test:db
 */

const here = dirname(fileURLToPath(import.meta.url));
const migrations = join(here, "..", "migrations");
const src = join(here, "..", "..", "src");
const FIRST_NEW = "20261013000210";
const db = new PGlite();

const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const one = async (sql, params = []) => (await q(sql, params))[0];
const plain = (rows) => rows.map((row) => ({ ...row }));

const id = {
  admin: "00000000-0000-4000-8000-0000000000a1",
  publisher: "00000000-0000-4000-8000-0000000000a2",
};

/** Runs `fn` as a signed-in user (null = anonymous reader), with a second factor. */
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

const SEARCHES = [
  "ukraine",
  "russia war",
  "china",
  "africa",
  "climate",
  "water",
  "smuggling",
  "libyan",
  "cote",
  "glacier",
  "routes",
  "secret",
  "zz-no-hit",
  "",
];

/**
 * Tricky markup the tag stripper must treat exactly as before: nested and
 * unpaired brackets, scripts, comments, entities. Pseudo-random, but the same
 * every run.
 */
function markupCorpus() {
  const parts = [
    "<",
    ">",
    "<",
    ">",
    "a",
    " ",
    "b",
    "<b>",
    "</p>",
    "<br>",
    "<br/>",
    "&amp;",
    "&#65;",
    "&#x41;",
    "&#0;",
    "&#38;",
    "&lt;",
    "&gt;",
    "<script>",
    "</script>",
    "<style>",
    "</style >",
    "<!--",
    "-->",
    "&",
    "#",
    ";",
    "\n",
    "é",
    "&nbsp;",
    '<a href="x>y">',
    "</div>",
    "<h2>",
    "x",
  ];
  let seed = 7;
  const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648);
  const out = [
    "a<br>b</p>c<b>d</b>e <scr<b>ipt>x",
    "<p>Smugglers sell <b>pass</b>age &amp; promises.</p>",
    "1 < 2 and 3 > 2",
    "&#38;#65; &#x2019;&#8217;&rsquo;&amp;lt;",
    "<<b>>x<</b>>",
    "a > b < c",
  ];
  for (let i = 0; i < 1500; i++) {
    let text = "";
    for (let n = next() % 30; n >= 0; n--) text += parts[next() % parts.length];
    out.push(text);
  }
  return out;
}

const CORPUS = markupCorpus();

async function snapshot() {
  const out = { search: {}, topics: {} };
  for (const text of SEARCHES) {
    out.search[text] = {
      owner: plain(await q("select * from search($1, 40) order by rank desc, title, id", [text])),
      anon: await as(null, async () =>
        plain(await q("select * from search($1, 40) order by rank desc, title, id", [text])),
      ),
    };
    out.topics[text] = {
      owner: plain(await q("select * from search_topics($1, 50)", [text])),
      anon: await as(null, async () =>
        plain(await q("select * from search_topics($1, 50)", [text])),
      ),
    };
  }
  out.markup = (
    await q(
      "select html_plain_text(t) as t from unnest($1::text[]) with ordinality as u(t, n) order by n",
      [CORPUS],
    )
  ).map((row) => row.t);
  out.chapters = plain(
    await q("select id, search::text as search from entry_chapters order by id"),
  );
  out.intros = plain(
    await q(
      "select id, topic_intro_search(title, summary, body_html)::text as v from entries order by id",
    ),
  );
  out.bodies = (
    await q(
      `select html_plain_text(body_html) as t from (
         select id, body_html from entries union all select id, body_html from entry_chapters) b order by id`,
    )
  ).map((row) => row.t);
  return out;
}

let before_ = null;
let after_ = null;
/** The same snapshot after the migration (taken once, before any test writes). */
const afterSnapshot = async () => (after_ ??= await snapshot());

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

  for (const [uid, email, role] of [
    [id.admin, "admin@atlasoftodaysworld.org", "admin"],
    [id.publisher, "pub@atlasoftodaysworld.org", "publisher"],
  ]) {
    await q("insert into auth.users (id, email) values ($1, $2)", [uid, email]);
    await q("update profiles set role_id = $2, kind = 'staff', status = 'active' where id = $1", [
      uid,
      role,
    ]);
  }

  // Published topics with chapters; a draft topic, a pending news item, a
  // translation — the last three must never show up for anyone through search.
  await db.exec(`
    insert into entries (slug, title, summary, category, region_slug, status, kind, body_html) values
      ('zz-smuggling', 'Migrant Smuggling', 'How moving people across borders works.', 'Society',
       'latin-america-caribbean', 'published', 'entry',
       '<p>Smugglers sell <b>pass</b>age &amp; promises.</p>'),
      ('zz-sahel', 'The Sahel', 'Coups and trade.', 'Society',
       'latin-america-caribbean', 'published', 'entry', ''),
      ('zz-draft-topic', 'Glacier Secret Draft', 'Not yet out.', 'Society',
       'latin-america-caribbean', 'draft', 'entry', '<p>Glacier secret melt.</p>'),
      ('zz-pending-news', 'Secret routes news', 'Pending.', 'Society',
       'latin-america-caribbean', 'pending', 'news', '<p>Secret glacier routes.</p>'),
      ('zz-glacier-news', 'Glacier news', 'A news item.', 'Society',
       'latin-america-caribbean', 'published', 'news', '<p>Glacier melt in the Alps.</p>');
    insert into entries (slug, title, summary, category, region_slug, status, kind, locale, translation_of, body_html)
      select slug, 'Pašeráctví migrantů', 'Libyan glacier secret routes', category, region_slug,
             'published', kind, 'cs', id, '<p>Libyan glacier secret routes</p>'
      from entries where slug = 'zz-smuggling';

    insert into entry_chapters (entry_id, position, title, body_html)
      select id, 0, 'Why people move', '<p>Wars, poverty and hope.</p>' from entries
      where slug = 'zz-smuggling' and translation_of is null;
    insert into entry_chapters (entry_id, position, title, body_html)
      select id, 1, 'Smuggling Routes',
             '<p>Boats leave the Libyan coast at night.</p><p>Routes through C&#244;te d&#39;Ivoire and '
             || '<a href="/x">Côte d''Ivoire</a> and Niger shift with policy.</p>'
             || '<script>alert(1)</script><!-- glacier -->'
      from entries where slug = 'zz-smuggling' and translation_of is null;
    insert into entry_chapters (entry_id, position, title, body_html)
      select id, 3, 'Coups', '<p>Niger saw a coup in 2023. Trade routes changed.</p>'
      from entries where slug = 'zz-sahel';
    insert into entry_chapters (entry_id, position, title, body_html)
      select id, 7, 'Glacier retreat', '<p>Ice in the Sahel? No: glaciers, glacial <<b>>lakes<</b>>.</p>'
      from entries where slug = 'zz-sahel';
    insert into entry_chapters (entry_id, position, title, body_html)
      select id, 0, 'Secret glacier', '<p>Glacier melt, secret.</p>' from entries where slug = 'zz-draft-topic';
    insert into entry_chapters (entry_id, position, title, body_html)
      select id, 0, 'Secret chapter', '<p>Secret routes.</p>' from entries where slug = 'zz-pending-news';
    insert into entry_chapters (entry_id, position, title, body_html)
      select id, 0, 'Secret translated chapter', '<p>Secret glacier.</p>' from entries where slug = 'zz-smuggling' and translation_of is not null;
  `);

  before_ = await snapshot();
  await apply(files.filter((f) => f >= FIRST_NEW));
});

// ---------------------------------------------------------------------------
// html_plain_text(): same text, linear time
// ---------------------------------------------------------------------------

test("html_plain_text: same output as before on tricky markup and on all stored bodies", async () => {
  const after = await afterSnapshot();
  assert.equal(after.markup.length, CORPUS.length);
  for (let i = 0; i < CORPUS.length; i++) {
    assert.equal(
      after.markup[i],
      before_.markup[i],
      `html_plain_text(${JSON.stringify(CORPUS[i])})`,
    );
  }
  assert.deepEqual(after.bodies, before_.bodies);
  // The rebuilt generated column and index expression hold the same vectors.
  assert.deepEqual(after.chapters, before_.chapters);
  assert.deepEqual(after.intros, before_.intros);
  assert.equal(
    (await one("select html_plain_text('a<br>b</p>c<b>d</b>e <scr<b>ipt>x') as t")).t,
    "a b cde x",
  );
});

test("html_plain_text: 200k characters of nested brackets finish in linear time", async () => {
  const cases = [
    ["<".repeat(200_000), ""],
    [`${"<".repeat(100_000)}x${">".repeat(100_000)}`, ""],
    [`${"<".repeat(100_000)}${">".repeat(100_000)}tail`, "tail"],
    [`${"<a".repeat(100_000)}`, "a".repeat(100_000)],
    // Unpaired '<' are dropped, the rest is text.
    ["<script".repeat(30_000), "script".repeat(30_000)],
    ["<!--".repeat(50_000), "!--".repeat(50_000)],
    [Array.from({ length: 25_000 }, (_, i) => `&#${i + 100};`).join(""), null],
  ];
  for (const [html, expected] of cases) {
    const started = performance.now();
    const { t } = await one("select html_plain_text($1) as t", [html]);
    const ms = performance.now() - started;
    // The previous loop needed minutes for the nested cases; this takes ~1 s in PGlite.
    assert.ok(
      ms < 10_000,
      `${html.slice(0, 12)}… (${html.length} chars) took ${Math.round(ms)} ms`,
    );
    if (expected !== null) assert.equal(t.length, expected.length);
  }
  // Input past the longest body the tables allow is not read.
  const long = await one("select length(html_plain_text(repeat('ab ', 300000))) as n");
  assert.ok(long.n <= 400_000, String(long.n));
});

// ---------------------------------------------------------------------------
// The RPCs: same results, definer, published originals only
// ---------------------------------------------------------------------------

test("search() and search_topics() return exactly what they did before", async () => {
  const after = await afterSnapshot();
  for (const text of SEARCHES) {
    for (const who of ["owner", "anon"]) {
      assert.ok(before_.search[text][who].length < 40, `"${text}" hits the search() limit`);
      assert.ok(before_.topics[text][who].length < 50, `"${text}" hits the search_topics() limit`);
      assert.deepEqual(
        after.search[text][who],
        before_.search[text][who],
        `search("${text}") for ${who}`,
      );
      assert.deepEqual(
        after.topics[text][who],
        before_.topics[text][who],
        `search_topics("${text}") for ${who}`,
      );
    }
  }
  assert.ok(after.topics.glacier.anon.length > 0 && after.search.glacier.anon.length > 0);
});

test("search() and search_topics() run as definer and never return unpublished or translated rows", async () => {
  const fns = await q(
    `select proname, prosecdef, proconfig from pg_proc
     where pronamespace = 'public'::regnamespace and proname in ('search', 'search_topics') order by 1`,
  );
  assert.deepEqual(
    fns.map((f) => [f.proname, f.prosecdef, f.proconfig]),
    [
      ["search", true, ["search_path=public, pg_temp"]],
      ["search_topics", true, ["search_path=public, pg_temp"]],
    ],
  );
  for (const who of [null, id.admin, id.publisher]) {
    const hits = await as(who, async () => ({
      search: await q("select id, url from search('secret', 40)"),
      topics: await q("select slug, heading from search_topics('secret', 50)"),
      glacier: await q("select slug from search_topics('glacier', 50)"),
    }));
    assert.deepEqual(hits.search, [], `search('secret') for ${who}`);
    assert.deepEqual(hits.topics, [], `search_topics('secret') for ${who}`);
    assert.deepEqual(
      hits.glacier.map((row) => row.slug),
      ["zz-sahel"],
      `search_topics('glacier') for ${who}`,
    );
  }
});

// ---------------------------------------------------------------------------
// Helpers are not RPCs
// ---------------------------------------------------------------------------

const HELPERS = {
  "fold_text('x')": "authenticated",
  "html_plain_text('<b>x</b>')": "authenticated",
  "topic_search_vector('a', 'b')": "authenticated",
  "topic_intro_search('a', 'b', '<p>c</p>')": "authenticated",
  "search_words('glacier')": null,
  "prefix_tsquery(array['glacier'])": null,
  "topic_hit_score(to_tsvector('simple', 'glacier'), array['glacier'])": null,
  "search_snippet('glacier text', array['glacier'])": null,
  "search_query('glacier')": null,
};

test("anon cannot call the search helpers; authenticated only those its writes evaluate", async () => {
  for (const [call, role] of Object.entries(HELPERS)) {
    await as(null, () => refused(q(`select ${call}`), /permission denied for function/));
    if (role === "authenticated") {
      await as(id.publisher, () => q(`select ${call}`));
    } else {
      await as(id.publisher, () => refused(q(`select ${call}`), /permission denied for function/));
    }
    // Server-side imports with the service key still have them.
    await db.exec("set role service_role");
    try {
      await q(`select ${call}`);
    } finally {
      await db.exec("reset role");
    }
  }
});

// ---------------------------------------------------------------------------
// Writers: generated column and index expression still work
// ---------------------------------------------------------------------------

test("editors still insert and update chapters and topics (generated column, intro index)", async () => {
  // A publisher's own draft topic, written directly and through the RPC.
  const entry = await as(id.publisher, () =>
    one(
      `insert into entries (slug, title, summary, category, region_slug, owner_id, kind, body_html)
       values ('zz-writer-topic', 'Writer topic', 'Summary', 'Society', 'latin-america-caribbean', $1, 'entry',
               '<p>Body <b>text</b></p>') returning id`,
      [id.publisher],
    ),
  );
  await as(id.publisher, async () => {
    await q(
      "insert into entry_chapters (entry_id, position, title, body_html) values ($1, 0, 'Caravans', '<p>Camels &amp; caravans</p>')",
      [entry.id],
    );
    await q("update entry_chapters set body_html = '<p>Camels and oases</p>' where entry_id = $1", [
      entry.id,
    ]);
    await q("select replace_entry_parts($1, 'chapters', $2::jsonb)", [
      entry.id,
      JSON.stringify([{ title: "Oases", body_html: "<p>Water <<b>>in<</b>> the desert</p>" }]),
    ]);
    await q("update entries set body_html = '<p>New body</p>' where id = $1", [entry.id]);
  });
  const chapter = await one("select search::text as s from entry_chapters where entry_id = $1", [
    entry.id,
  ]);
  assert.match(chapter.s, /'oases':1A/);
  assert.match(chapter.s, /'desert'/);
  assert.doesNotMatch(chapter.s, /'b'/);

  // An admin edits a published original topic: the partial intro index applies.
  await as(id.admin, async () => {
    await q(
      "update entries set summary = 'Caravan routes and borders.' where slug = 'zz-smuggling'",
    );
    await q(
      `update entry_chapters set body_html = '<p>Boats leave the Libyan coast at dawn.</p>'
       where title = 'Smuggling Routes'`,
    );
  });
  assert.deepEqual(
    (await as(null, () => q("select slug, anchor from search_topics('caravan')"))).map((r) => [
      r.slug,
      r.anchor,
    ]),
    [["zz-smuggling", null]],
  );
  assert.deepEqual(
    (await as(null, () => q("select anchor from search_topics('dawn')"))).map((r) => r.anchor),
    ["topic-2"],
  );
});

test("the writers' grant is what lets them write (Postgres checks EXECUTE as the writer)", async () => {
  // Why authenticated keeps the four helpers: without them, chapter writes fail.
  await db.exec("revoke execute on function public.html_plain_text(text) from authenticated");
  try {
    const entry = await one("select id from entries where slug = 'zz-writer-topic'");
    await as(id.publisher, () =>
      refused(
        q("insert into entry_chapters (entry_id, position, title) values ($1, 5, 'Nope')", [
          entry.id,
        ]),
        /permission denied for function html_plain_text/,
      ),
    );
  } finally {
    await db.exec("grant execute on function public.html_plain_text(text) to authenticated");
  }
});

// ---------------------------------------------------------------------------
// Every RPC the app calls is executable by the role that calls it
// ---------------------------------------------------------------------------

/** RPC → the role the app calls it as (public client = anon, session = authenticated, service key). */
const APP_RPCS = {
  search: ["anon"],
  search_topics: ["anon"],
  portrait: ["anon"],
  entry_preview: ["anon"],
  entry_preview_parts: ["anon"],
  planned_entries: ["anon"],
  patron_stats: ["anon"],
  can_approve_entry: ["authenticated"],
  can_approve_entries: ["authenticated"],
  can_edit_entry: ["authenticated"],
  my_permissions: ["authenticated"],
  my_role: ["authenticated"],
  mfa_status: ["authenticated"],
  claim_invitation: ["authenticated"],
  staff_name: ["authenticated"],
  replace_entry_parts: ["authenticated"],
  replace_tiles: ["authenticated"],
  set_default_topic_template: ["authenticated"],
  apply_topic_template: ["authenticated"],
  save_topic_as_template: ["authenticated"],
  submit_entry: ["authenticated"],
  approve_entry: ["authenticated"],
  unpublish_entry: ["authenticated"],
  send_back_entry: ["authenticated"],
  schedule_entry: ["authenticated"],
  unschedule_entry: ["authenticated"],
  create_preview_link: ["authenticated"],
  role_holder_counts: ["authenticated"],
  replace_portrait_items: ["authenticated", "service_role"],
  submit_volunteer_application: ["service_role"],
  hit_rate_limit: ["service_role"],
};

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|mjs)$/.test(entry.name) && !/\.test\./.test(entry.name) ? [path] : [];
  });
}

test("every RPC the app calls is listed here", () => {
  const called = new Set();
  for (const file of [...sourceFiles(src), ...sourceFiles(join(here, "..", "..", "scripts"))]) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(/\.rpc\(\s*"([a-z_]+)"/g)) called.add(match[1]);
    // workflow-actions.ts calls `rpc(fn)` with fn from a union of names.
    for (const match of text.matchAll(/type Transition = ([^;]+);/g)) {
      for (const name of match[1].matchAll(/"([a-z_]+)"/g)) called.add(name[1]);
    }
  }
  assert.ok(called.has("search") && called.has("approve_entry"), "the scan finds RPC calls");
  const missing = [...called].filter((name) => !(name in APP_RPCS));
  assert.deepEqual(missing, [], "add new RPCs to APP_RPCS with the role that calls them");
});

test("every RPC the app calls is executable by its role, with an explicit grant", async () => {
  for (const [name, roles] of Object.entries(APP_RPCS)) {
    const fns = await q(
      `select p.oid::regprocedure::text as sig, p.proacl::text as acl
       from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = $1`,
      [name],
    );
    assert.equal(fns.length, 1, `${name}: exactly one function`);
    for (const role of roles) {
      const ok = await one("select has_function_privilege($1, $2, 'execute') as ok", [
        role,
        fns[0].sig,
      ]);
      assert.ok(ok.ok, `${role} may execute ${fns[0].sig}`);
      // Named in the ACL itself, not only through PUBLIC.
      const named = (fns[0].acl ?? "")
        .replace(/[{}"]/g, "")
        .split(",")
        .some(
          (item) => item.startsWith(`${role}=`) && item.split("=")[1].split("/")[0].includes("X"),
        );
      assert.ok(named, `${fns[0].sig}: explicit grant to ${role} (${fns[0].acl})`);
    }
    for (const role of ["anon", "authenticated"].filter((r) => !roles.includes(r))) {
      if (role === "authenticated" && roles.includes("anon")) continue;
      const ok = await one("select has_function_privilege($1, $2, 'execute') as ok", [
        role,
        fns[0].sig,
      ]);
      assert.ok(!ok.ok, `${role} must not execute ${fns[0].sig}`);
    }
  }
});

// ---------------------------------------------------------------------------
// Table privileges and default privileges
// ---------------------------------------------------------------------------

test("anon and authenticated hold no truncate/references/trigger/maintain; anon no writes", async () => {
  const extra = await q(
    `select c.relname, r.role, p.priv
     from pg_class c
     cross join (values ('anon'), ('authenticated')) r(role)
     cross join (values ('truncate'), ('references'), ('trigger'), ('maintain'),
                        ('insert'), ('update'), ('delete')) p(priv)
     where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v', 'm', 'p')
       and (p.priv not in ('insert', 'update', 'delete') or r.role = 'anon')
       and has_table_privilege(r.role, c.oid, p.priv)`,
  );
  assert.deepEqual(plain(extra), []);
});

test("objects created later get no privileges for anon, authenticated or PUBLIC by default", async () => {
  await db.exec(`
    begin;
    create table public.zz_later (id integer generated always as identity primary key, note text);
    create sequence public.zz_later_seq;
    create function public.zz_later_fn() returns integer language sql as 'select 1';
  `);
  try {
    const privs = await one(`
      select has_table_privilege('anon', 'public.zz_later', 'select') as anon_select,
             has_table_privilege('authenticated', 'public.zz_later', 'insert') as auth_insert,
             has_table_privilege('service_role', 'public.zz_later', 'select') as service_select,
             has_sequence_privilege('anon', 'public.zz_later_seq', 'usage') as anon_seq,
             has_sequence_privilege('authenticated', 'public.zz_later_seq', 'usage') as auth_seq,
             has_function_privilege('anon', 'public.zz_later_fn()', 'execute') as anon_fn,
             has_function_privilege('authenticated', 'public.zz_later_fn()', 'execute') as auth_fn,
             has_function_privilege('service_role', 'public.zz_later_fn()', 'execute') as service_fn`);
    assert.deepEqual(
      { ...privs },
      {
        anon_select: false,
        auth_insert: false,
        service_select: true,
        anon_seq: false,
        auth_seq: false,
        anon_fn: false,
        auth_fn: false,
        service_fn: true,
      },
    );
  } finally {
    await db.exec("rollback");
  }
});
