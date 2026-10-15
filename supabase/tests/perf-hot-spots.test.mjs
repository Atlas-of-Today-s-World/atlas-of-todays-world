import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";

/**
 * Database hot spots (migration 20261013000340):
 *  - entry_revisions.published is stored (generated from the snapshot) and
 *    indexed; pruning and the "published version" lookup use it;
 *  - replace_entry_parts() / replace_portrait_items() run as SECURITY DEFINER
 *    with the policy conditions checked once - every role gets exactly the
 *    outcome it got under RLS (compared call by call with the previous
 *    SECURITY INVOKER bodies), including the frozen pending entry (#183);
 *  - audit log search has GIN trigram indexes that its `ilike` filters use.
 * Supabase stubs + every migration in PGlite, here with pg_trgm loaded (as on
 * Supabase).
 *
 * Run: npm run test:db
 */

const here = dirname(fileURLToPath(import.meta.url));
const migrations = join(here, "..", "migrations");
const MIGRATION = "20261013000340_perf_hot_spots.sql";
const db = new PGlite({ extensions: { pg_trgm } });

const id = {
  admin: "00000000-0000-4000-8000-000000000f01",
  editor: "00000000-0000-4000-8000-000000000f02",
  pubA: "00000000-0000-4000-8000-000000000f03",
  pubB: "00000000-0000-4000-8000-000000000f04",
  approver: "00000000-0000-4000-8000-000000000f05",
  reader: "00000000-0000-4000-8000-000000000f06",
  observer: "00000000-0000-4000-8000-000000000f07",
  dataEditor: "00000000-0000-4000-8000-000000000f08",
  newsWriter: "00000000-0000-4000-8000-000000000f09",
  // Edits portraits ("e") without the right to delete their items.
  noDelete: "00000000-0000-4000-8000-000000000f0b",
  blocked: "00000000-0000-4000-8000-000000000f0c",
};
const USERS = [null, ...Object.values(id)];
const who = (user) => Object.keys(id).find((key) => id[key] === user) ?? "anon";

const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const one = async (sql, params = []) => (await q(sql, params))[0];

/** A signed-up account (verified e-mail), then given a role by the service key. */
async function account(uid, email, role, status = "active") {
  await q("insert into auth.users (id, email, email_confirmed_at) values ($1, $2, now())", [
    uid,
    email,
  ]);
  await q("update profiles set role_id = $2, status = $3 where id = $1", [uid, role, status]);
}

/**
 * Runs `sql` as `user` (null = anon) inside a transaction that is rolled back,
 * and returns the outcome: the error code, or the state `snapshot` reads after it.
 */
async function attempt(user, sql, params, snapshot) {
  await db.exec("begin");
  try {
    await db.exec(`select set_config('request.jwt.claim.sub', '${user ?? ""}', true);
      select set_config('request.jwt.claims', '{"aal":"aal2"}', true);
      set local role ${user ? "authenticated" : "anon"};`);
    try {
      await db.query(sql, params);
    } catch (error) {
      return { error: error.code ?? String(error.message) };
    }
    await db.exec("reset role");
    return { state: (await one(snapshot.sql, snapshot.params)).state };
  } finally {
    await db.exec("rollback");
  }
}

/** The old (SECURITY INVOKER) function as `<name>_invoker`, from its last migration. */
async function keepInvokerCopy(name) {
  const { def } = await one(
    `select pg_get_functiondef(p.oid) as def from pg_proc p
     where p.pronamespace = 'public'::regnamespace and p.proname = $1`,
    [name],
  );
  assert.doesNotMatch(def, /SECURITY DEFINER/, `${name} was security invoker before`);
  await db.exec(def.replace(`public.${name}(`, `public.${name}_invoker(`));
  await db.exec(`grant execute on function public.${name}_invoker to authenticated`);
}

let entries = {};
let foreignTile;

before(async () => {
  await db.exec(readFileSync(join(here, "supabase-stubs.sql"), "utf8"));
  for (const file of readdirSync(migrations)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    // The functions as they were, kept next to the new ones for comparison.
    if (file === MIGRATION) {
      await keepInvokerCopy("replace_entry_parts");
      await keepInvokerCopy("replace_portrait_items");
    }
    try {
      await db.exec(readFileSync(join(migrations, file), "utf8"));
    } catch (error) {
      throw new Error(`${file}: ${error.message}`);
    }
  }
  await db.exec(`
    insert into regions (slug, name, fill, stroke, center_lon, center_lat) values
      ('latin-america-caribbean', 'Latin America & Caribbean', '#aaaaaa', '#555555', -60, -10);
    insert into countries (iso3, slug, name, region_slug) values
      ('BRA', 'brazil', 'Brazil', 'latin-america-caribbean'),
      ('ARG', 'argentina', 'Argentina', 'latin-america-caribbean');
    insert into special_regions (slug, name, fill, stroke, center_lon, center_lat, kind)
      values ('visegrad', 'Visegrad Group', '#336699', '#224466', 17, 49, 'region');
    insert into roles (id, name, news_scope) values
      ('news-writer', 'News writer', 'own'),
      ('no-delete', 'Portrait editor without delete', 'all');
    insert into role_permissions (role_id, section, actions) values
      ('news-writer', 'news', 'vce'),
      ('no-delete', 'news', 'vce');
  `);
  await account(id.admin, "admin@atlasoftodaysworld.org", "admin");
  await account(id.editor, "editor@atlasoftodaysworld.org", "content-editor");
  await account(id.pubA, "pub.a@atlasoftodaysworld.org", "publisher");
  await account(id.pubB, "pub.b@atlasoftodaysworld.org", "publisher");
  await account(id.approver, "approver@atlasoftodaysworld.org", "content-approver");
  await account(id.reader, "reader@example.org", "reader");
  await account(id.observer, "observer@atlasoftodaysworld.org", "observer");
  await account(id.dataEditor, "data@atlasoftodaysworld.org", "data-editor");
  await account(id.newsWriter, "writer@atlasoftodaysworld.org", "news-writer");
  await account(id.noDelete, "nodelete@atlasoftodaysworld.org", "no-delete");
  await account(id.blocked, "blocked@atlasoftodaysworld.org", "content-editor", "blocked");
  await q("insert into approver_countries values ($1, 'BRA')", [id.approver]);

  // One topic of pubA's in every status, each with all its parts.
  for (const status of ["planned", "draft", "pending", "published"]) {
    const entry = (
      await one(
        `insert into entries (slug, title, summary, category, region_slug, owner_id, status)
         values ($1, $1, 'Summary', 'Society', 'latin-america-caribbean', $2, $3) returning id`,
        [`topic-${status}`, id.pubA, status],
      )
    ).id;
    await q("insert into entry_countries (entry_id, country_iso3) values ($1, 'BRA')", [entry]);
    await q("update entries set kind = 'entry' where id = $1", [entry]);
    const tile = (
      await one("select id from learn_more_tiles where entry_id = $1 order by position limit 1", [
        entry,
      ])
    ).id;
    const chapters = await q(
      `insert into entry_chapters (entry_id, position, title, body_html, created_at, created_by)
       values ($1, 0, 'One', '<p>1</p>', '2026-01-01', $2), ($1, 1, 'Two', '<p>2</p>', '2026-01-01', $2)
       returning id`,
      [entry, id.pubA],
    );
    await q(
      `insert into resources (entry_id, position, tile_id, title, url) values
         ($1, 0, $2, 'Old A', 'https://a.example'), ($1, 1, $2, 'Old B', 'https://b.example')`,
      [entry, tile],
    );
    await q(
      "insert into entry_faq (entry_id, position, question, answer) values ($1, 0, 'Old?', 'Yes.')",
      [entry],
    );
    await q(
      "insert into entry_tile_notes (entry_id, tile_id, body_html) values ($1, $2, '<p>n</p>')",
      [entry, tile],
    );
    entries[status] = { id: entry, tile, chapters: chapters.map((row) => row.id) };
  }
  foreignTile = entries.published.tile;

  // Portrait sections with content to replace.
  await db.exec(`
    insert into timeline_events (region_slug, position, date_label, title) values ('latin-america-caribbean', 0, '1990', 'Old');
    insert into timeline_events (special_slug, position, date_label, title) values ('visegrad', 0, '1991', 'Old');
    insert into faq_items (region_slug, position, question, answer) values ('latin-america-caribbean', 0, 'Old?', 'Yes.');
    insert into resources (region_slug, position, kind, title, url)
      values ('latin-america-caribbean', 0, 'Videos & Documentaries', 'Old', 'https://old.example');
    insert into visual_embeds (region_slug, position, provider, title, url)
      values ('latin-america-caribbean', 0, 'image', 'Old', 'https://old.example/map.png');
    insert into portrait_metrics (region_slug, position, value, label, source) values ('latin-america-caribbean', 0, '1', 'Old', 'Atlas');
    insert into portrait_metrics (special_slug, position, value, label, source) values ('visegrad', 0, '1', 'Old', 'Atlas');
    insert into portrait_metrics (country_iso3, position, value, label, source) values ('BRA', 0, '1', 'Old', 'Atlas');
  `);
});

// ---------------------------------------------------------------------------
// a) Revisions
// ---------------------------------------------------------------------------

test("revisions: `published` follows the snapshot's status, on every insert path", async () => {
  const entry = entries.draft.id;
  await q(
    `insert into entry_revisions (entry_id, snapshot) values
       ($1, '{"status":"published","title":"live"}'), ($1, '{"status":"draft","title":"draft"}'),
       ($1, '{"title":"no status"}')`,
    [entry],
  );
  const rows = await q(
    "select snapshot ->> 'title' as title, published from entry_revisions where entry_id = $1 order by id",
    [entry],
  );
  assert.deepEqual(
    rows.map((row) => [row.title, row.published]),
    [
      ["live", true],
      ["draft", false],
      ["no status", false],
    ],
  );
  // The trigger's own revision: the old row was published.
  const live = entries.published.id;
  await q("update entries set title = 'Retitled' where id = $1", [live]);
  const kept = await one(
    "select published from entry_revisions where entry_id = $1 order by id desc limit 1",
    [live],
  );
  assert.equal(kept.published, true);
  // Nobody writes it: it is generated.
  await assert.rejects(
    q("update entry_revisions set published = false where entry_id = $1", [live]),
  );
});

test("revisions: an index serves the published lookup and the prune", async () => {
  const index = await one(
    "select pg_get_indexdef('public.entry_revisions_entry_published'::regclass) as def",
  );
  assert.match(index.def, /\(entry_id, published, saved_at DESC\)/);
  await q(
    `insert into entry_revisions (entry_id, snapshot)
     select $1, jsonb_build_object('status', 'draft', 'n', n) from generate_series(1, 3000) n`,
    [entries.planned.id],
  );
  await db.exec("analyze entry_revisions");
  const plan = (
    await q(
      `explain select snapshot ->> 'title' from entry_revisions
       where entry_id = $1 and published order by saved_at desc, id desc limit 1`,
      [entries.planned.id],
    )
  )
    .map((row) => row["QUERY PLAN"])
    .join("\n");
  assert.match(plan, /entry_revisions_entry_published/);
  // The prune function reads the flag, not the snapshot.
  const fn = await one("select prosrc from pg_proc where proname = 'prune_entry_revisions'");
  assert.doesNotMatch(fn.prosrc, /snapshot/);
});

// ---------------------------------------------------------------------------
// b) Bulk part saves: definer, same outcome for everyone
// ---------------------------------------------------------------------------

test("replace_entry_parts and replace_portrait_items are security definer with a fixed search_path", async () => {
  const rows = await q(
    `select proname, prosecdef, proconfig, proacl::text as acl from pg_proc
     where pronamespace = 'public'::regnamespace
       and proname in ('replace_entry_parts', 'replace_portrait_items')`,
  );
  assert.equal(rows.length, 2);
  for (const row of rows) {
    assert.equal(row.prosecdef, true, row.proname);
    assert.deepEqual(row.proconfig, ["search_path=public, pg_temp"], row.proname);
    assert.match(row.acl, /authenticated=X/, row.proname);
    assert.doesNotMatch(row.acl, /(^|[{,])=X|anon=X/, `${row.proname}: not for PUBLIC or anon`);
  }
});

/** Everything a part save can change, without generated ids and times. */
const partsSnapshot = (entry) => ({
  sql: `select json_build_object(
      'chapters', (select coalesce(json_agg(json_build_object(
          'position', c.position, 'title', c.title, 'body', c.body_html,
          'kept', c.id = any($2::uuid[]), 'created_by', c.created_by, 'updated_by', c.updated_by,
          'created_at_kept', c.created_at = '2026-01-01'::timestamptz)
          order by c.position, c.title), '[]') from entry_chapters c where c.entry_id = $1),
      'resources', (select coalesce(json_agg(json_build_object(
          'position', r.position, 'title', r.title, 'url', r.url, 'tile', r.tile_id, 'kind', r.kind)
          order by r.position, r.title), '[]') from resources r where r.entry_id = $1),
      'faq', (select coalesce(json_agg(json_build_object('position', f.position, 'q', f.question)
          order by f.position, f.question), '[]') from entry_faq f where f.entry_id = $1),
      'notes', (select coalesce(json_agg(json_build_object('tile', n.tile_id, 'body', n.body_html)
          order by n.body_html), '[]') from entry_tile_notes n where n.entry_id = $1),
      'entry', (select json_build_object('status', e.status, 'publish_at', e.publish_at)
          from entries e where e.id = $1)) as state`,
  params: [entry.id, entry.chapters],
});

test("replace_entry_parts: every role and status gets the outcome it had under RLS", async () => {
  let compared = 0;
  const allowed = new Set();
  for (const [status, entry] of Object.entries(entries)) {
    const payloads = [
      ["chapters", []],
      [
        "chapters",
        [
          { id: entry.chapters[0], title: "One", body_html: "<p>1</p>" },
          { title: "New", body_html: "<p>new</p>" },
        ],
      ],
      ["resources", []],
      [
        "resources",
        [
          { tile_id: entry.tile, title: "New", url: "https://new.example" },
          { kind: "Lectures & Debates", title: "Talk", url: "https://talk.example" },
        ],
      ],
      ["faq", [{ question: "New?", answer: "Yes." }]],
      ["tile_notes", [{ tile_id: entry.tile, body_html: "<p>note</p>" }]],
      ["tile_notes", [{ tile_id: foreignTile, body_html: "<p>elsewhere</p>" }]],
      ["tile_notes", [{ tile_id: entry.tile, body_html: "   " }]],
      ["timeline", []],
    ];
    for (const user of USERS) {
      for (const [part, items] of payloads) {
        const params = [entry.id, part, JSON.stringify(items)];
        const run = (fn) =>
          attempt(user, `select ${fn}($1, $2, $3::jsonb)`, params, partsSnapshot(entry));
        const before = await run("replace_entry_parts_invoker");
        const after = await run("replace_entry_parts");
        assert.deepEqual(
          after,
          before,
          `${who(user)} | ${status} | ${part} ${JSON.stringify(items).slice(0, 60)}`,
        );
        if (after.state) allowed.add(`${who(user)}:${status}`);
        compared++;
      }
    }
  }
  assert.ok(compared > 400);
  // The comparison covers both sides of every rule: who may write which entry.
  for (const key of ["admin:draft", "editor:pending", "pubA:draft", "pubA:planned"]) {
    assert.ok(allowed.has(key), `${key} may save`);
  }
  for (const key of [
    "pubA:pending",
    "pubA:published",
    "pubB:draft",
    "approver:draft",
    "reader:draft",
    "anon:draft",
    "blocked:draft",
  ]) {
    assert.ok(!allowed.has(key), `${key} may not save`);
  }
});

test("replace_entry_parts: a pending entry stays frozen for its author, open to who may approve it", async () => {
  const entry = entries.pending;
  const items = JSON.stringify([{ title: "Swapped", body_html: "<p>x</p>" }]);
  const sql = "select replace_entry_parts($1, 'chapters', $2::jsonb)";
  for (const user of [id.pubA, id.newsWriter, id.approver]) {
    const result = await attempt(user, sql, [entry.id, items], partsSnapshot(entry));
    assert.deepEqual(result, { error: "42501" }, who(user));
  }
  for (const user of [id.editor, id.admin]) {
    const result = await attempt(user, sql, [entry.id, items], partsSnapshot(entry));
    assert.deepEqual(
      result.state.chapters.map((chapter) => chapter.title),
      ["Swapped"],
      who(user),
    );
  }
});

const PORTRAIT_TABLES = {
  timeline: "timeline_events",
  faq: "faq_items",
  resources: "resources",
  visuals: "visual_embeds",
  metrics: "portrait_metrics",
};

const portraitSnapshot = (kind, slug, collection) => {
  const table = PORTRAIT_TABLES[collection] ?? "timeline_events";
  const column = { region: "region_slug", issue: "special_slug", country: "country_iso3" }[kind];
  return {
    sql: `select coalesce(json_agg(r.row order by (r.row ->> 'position')::int, r.row::text), '[]') as state
          from (select to_jsonb(t) - 'id' - 'created_at' - 'updated_at' - 'updated_by' as row
                  from ${table} t
                 where t.${column} = $1${table === "resources" ? " and t.entry_id is null" : ""}) r`,
    params: [slug],
  };
};

test("replace_portrait_items: every role gets the outcome it had under RLS", async () => {
  const items = {
    timeline: [{ date_label: "2000", title: "New", body: "B" }],
    faq: [{ question: "New?", answer: "Yes." }],
    resources: [{ kind: "Videos & Documentaries", title: "New", url: "https://new.example" }],
    visuals: [{ provider: "image", title: "New", url: "https://new.example/map.png" }],
    metrics: [{ value: "2", label: "New", source: "Atlas" }],
  };
  const targets = [
    ...Object.keys(items).map((collection) => ["region", "latin-america-caribbean", collection]),
    ["issue", "visegrad", "timeline"],
    ["issue", "visegrad", "metrics"],
    ["country", "BRA", "metrics"],
    ["country", "BRA", "timeline"],
  ];
  let compared = 0;
  const allowed = new Set();
  for (const [kind, slug, collection] of targets) {
    for (const user of USERS) {
      for (const list of [[], items[collection]]) {
        const params = [kind, slug, collection, JSON.stringify(list)];
        const run = (fn) =>
          attempt(
            user,
            `select ${fn}($1, $2, $3, $4::jsonb)`,
            params,
            portraitSnapshot(kind, slug, collection),
          );
        const before = await run("replace_portrait_items_invoker");
        const after = await run("replace_portrait_items");
        assert.deepEqual(
          after,
          before,
          `${who(user)} | ${kind} ${slug} ${collection} | ${list.length} items`,
        );
        if (after.state) allowed.add(`${who(user)}:${kind}:${collection}`);
        compared++;
      }
    }
  }
  assert.ok(compared > 200);
  for (const key of [
    "editor:region:timeline",
    "admin:region:resources",
    "dataEditor:region:metrics",
    "dataEditor:issue:metrics",
    "noDelete:region:faq",
  ]) {
    assert.ok(allowed.has(key), `${key} may save`);
  }
  for (const key of [
    "pubA:region:timeline",
    "reader:region:faq",
    "anon:region:timeline",
    "dataEditor:region:timeline",
    "editor:region:metrics",
    "blocked:region:timeline",
  ]) {
    assert.ok(!allowed.has(key), `${key} may not save`);
  }
});

test("replace_portrait_items: without the delete right the old items stay, as under RLS", async () => {
  // data-editor: regions "vce": adds region metric cards, removes none.
  const sql =
    "select replace_portrait_items('region', 'latin-america-caribbean', 'metrics', $1::jsonb)";
  const items = JSON.stringify([{ value: "2", label: "New", source: "Atlas" }]);
  const result = await attempt(
    id.dataEditor,
    sql,
    [items],
    portraitSnapshot("region", "latin-america-caribbean", "metrics"),
  );
  assert.deepEqual(result.state.map((row) => row.label).sort(), ["New", "Old"]);
});

// ---------------------------------------------------------------------------
// c) Audit log search
// ---------------------------------------------------------------------------

test("audit search: trigram indexes serve the `ilike` filters", async () => {
  const indexes = await q(
    `select indexrelid::regclass::text as name, pg_get_indexdef(indexrelid) as def from pg_index
     where indrelid in ('public.audit_log'::regclass, 'public.profiles'::regclass)
       and pg_get_indexdef(indexrelid) like '%gin_trgm_ops%' order by 1`,
  );
  assert.deepEqual(
    indexes.map((row) => row.name),
    [
      "audit_log_action_trgm",
      "audit_log_actor_email_trgm",
      "audit_log_target_trgm",
      "profiles_email_trgm",
    ],
  );
  // pg_trgm lives in the `extensions` schema, as Supabase keeps it.
  const ext = await one(
    "select extnamespace::regnamespace::text as schema from pg_extension where extname = 'pg_trgm'",
  );
  assert.equal(ext.schema, "extensions");

  await q(
    // A year of changes; each row carries its detail (what changed), as real ones do.
    `insert into audit_log (at, actor_email, action, target, detail)
     select now() - make_interval(secs => n), 'user' || (n % 50) || '@example.org',
            (array['entries.update', 'profiles.update', 'roles.insert', 'site_pages.update'])[n % 4 + 1],
            'target-' || n, jsonb_build_object('changed', repeat('field ', 80))
     from generate_series(1, 5000) n`,
  );
  await q(
    "insert into audit_log (actor_email, action, target) values ('someone@example.org', 'entries.update', 'needle-topic')",
  );
  // As autovacuum leaves it: GIN's pending list merged, statistics fresh.
  await db.exec("vacuum analyze audit_log");
  // The query auditLog() sends (src/features/roles/editorial.ts), as the admin sees it.
  const search = `select id, at, actor, actor_email, action, target, detail from audit_log
     where action ilike '%needle%' or target ilike '%needle%' or actor_email ilike '%needle%'
     order by at desc limit 1000`;
  const plan = (await q(`explain ${search}`)).map((row) => row["QUERY PLAN"]).join("\n");
  for (const index of [
    "audit_log_action_trgm",
    "audit_log_target_trgm",
    "audit_log_actor_email_trgm",
  ]) {
    assert.ok(plan.includes(`Bitmap Index Scan on ${index}`), plan);
  }
  assert.doesNotMatch(plan, /Seq Scan/, plan);
  const found = await q(search);
  assert.deepEqual(
    found.map((row) => row.target),
    ["needle-topic"],
  );

  // The actor lookup by e-mail: with a handful of test profiles the planner rightly
  // scans the table, so only show the index can serve it.
  await db.exec("begin; set local enable_seqscan = off");
  try {
    const actors = (
      await q("explain select id from profiles where email ilike '%needle%' limit 100")
    )
      .map((row) => row["QUERY PLAN"])
      .join("\n");
    assert.match(actors, /profiles_email_trgm/, actors);
  } finally {
    await db.exec("rollback");
  }
});
