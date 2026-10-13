import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

/**
 * Column grants: which team member created or last changed a row of public
 * data is not readable by the public (security review S-L2, migration
 * 20261008000110_hide_internal_columns). The public site still reads every
 * column it lists, and the team keeps what the admin reads and writes.
 * Same harness as rls.test.mjs: Supabase stubs + every migration in PGlite.
 *
 * Run: npm run test:db
 */

const here = dirname(fileURLToPath(import.meta.url));
const migrations = join(here, "..", "migrations");
const db = new PGlite();

const id = {
  admin: "00000000-0000-4000-8000-000000000001",
  editor: "00000000-0000-4000-8000-000000000002",
  dataEditor: "00000000-0000-4000-8000-000000000003",
  reader: "00000000-0000-4000-8000-000000000004",
};

/** Runs `fn` as a signed-in user (null = anonymous reader) with a second factor. */
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

/** Who created or last changed a row — readable by the team only. */
const INTERNAL = {
  entry_chapters: ["created_by", "updated_by"],
  indicators: ["created_by"],
  indicator_values: ["updated_by"],
  map_areas: ["created_by"],
  special_regions: ["created_by"],
};

/** Every other column, granted by name. */
const PUBLIC = {
  entry_chapters:
    "id, entry_id, position, title, summary_points, body_html, illustration_url, illustration_credit, audio_url, tile_background, created_at, updated_at",
  indicators:
    "id, label, short_label, description, unit, decimals, source, source_url, type, scale, domain_min, domain_max, ramp, higher_is_better, latest_year, is_custom, updated_at, position",
  indicator_values:
    "indicator_id, country_iso3, value, year, note, source_note, is_manual, updated_at",
  map_areas:
    "id, slug, name, label, country_iso3, note, fill, stroke, geometry, created_at, updated_at",
  special_regions:
    "slug, name, subtitle, summary, fill, stroke, center_lon, center_lat, zoom, updated_at, timeline_title, timeline_subtitle, intro, hero_url, hero_credit, kind, content_status",
};

/** Tables a signed-in reader reads directly (`using (true)`), so they lose the columns too. */
const OPEN_TO_SIGNED_IN = ["indicators", "indicator_values", "map_areas", "special_regions"];

const hawaii = JSON.stringify({
  type: "Polygon",
  coordinates: [
    [
      [-161.2, 22.7],
      [-154, 20.6],
      [-154, 18.4],
      [-161.2, 22.7],
    ],
  ],
});

let entry;
let chapter;

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
  await db.exec(`
    insert into regions (slug, name, fill, stroke, center_lon, center_lat) values
      ('east-asia', 'East Asia', '#aaaaaa', '#555555', 110, 35);
    insert into countries (iso3, slug, name, region_slug) values
      ('JPN', 'japan', 'Japan', 'east-asia'),
      ('USA', 'united-states', 'United States', null);
  `);

  const people = [
    [id.admin, "admin@atlasoftodaysworld.org", "admin", "staff"],
    [id.editor, "editor@atlasoftodaysworld.org", "content-editor", "staff"],
    [id.dataEditor, "data@atlasoftodaysworld.org", "data-editor", "staff"],
    [id.reader, "reader@example.org", "reader", "reader"],
  ];
  for (const [uid, email, role, kind] of people) {
    await q("insert into auth.users (id, email) values ($1, $2)", [uid, email]);
    await q("update profiles set role_id = $2, kind = $3, status = 'active' where id = $1", [
      uid,
      role,
      kind,
    ]);
  }

  // One published row per table, stamped with a team member (as an import would leave it).
  entry = (
    await one(
      `insert into entries (slug, title, summary, category, region_slug, owner_id, status)
       values ('grants', 'Grants', 'Summary', 'Society', 'east-asia', $1, 'published') returning id`,
      [id.editor],
    )
  ).id;
  chapter = (
    await one(
      `insert into entry_chapters (entry_id, position, title, created_by, updated_by)
       values ($1, 0, 'First topic', $2, $2) returning id`,
      [entry, id.editor],
    )
  ).id;
  await q(
    `insert into indicators (id, label, domain_min, domain_max, created_by)
     values ('hdi', 'HDI', 0.4, 0.96, $1)`,
    [id.dataEditor],
  );
  await q(
    `insert into indicator_values (indicator_id, country_iso3, value, source_note, updated_by)
     values ('hdi', 'JPN', 0.92, 'UNDP HDR 2025', $1)`,
    [id.dataEditor],
  );
  await q(
    `insert into map_areas (slug, name, fill, stroke, geometry, country_iso3, created_by)
     values ('hawaii', 'Hawaii', '#4fb3a5', '#1f7166', $1, 'USA', $2)`,
    [hawaii, id.admin],
  );
  await q(
    `insert into special_regions (slug, name, fill, stroke, center_lon, center_lat, created_by)
     values ('climate', 'Climate', '#336699', '#224466', 0, 0, $1)`,
    [id.dataEditor],
  );
});

// ---------------------------------------------------------------------------
// Anonymous visitors (the public site's client)
// ---------------------------------------------------------------------------

test("anon: who created or changed a row is refused, column by column", async () => {
  await as(null, async () => {
    for (const [table, columns] of Object.entries(INTERNAL)) {
      for (const column of columns) {
        await refused(q(`select ${column} from ${table}`), /permission denied/);
      }
      // So is `select *` — the public site lists its columns.
      await refused(q(`select * from ${table}`), /permission denied/);
    }
  });
});

test("anon: every public column is still readable", async () => {
  await as(null, async () => {
    for (const [table, columns] of Object.entries(PUBLIC)) {
      const rows = await q(`select ${columns} from ${table}`);
      assert.equal(rows.length, 1, table);
    }
  });
});

test("anon: the public site's own queries still work", async () => {
  // The column lists the app sends with the public client (features/geography/queries.ts,
  // features/seo/queries.ts, features/entries/*queries.ts, features/topics/*.ts).
  const queries = [
    `select id, label, short_label, description, unit, decimals, source, source_url, type, scale,
            domain_min, domain_max, ramp, higher_is_better, latest_year
       from indicators order by position, id`,
    "select indicator_id, country_iso3, value, year from indicator_values order by indicator_id, country_iso3",
    `select slug, name, subtitle, summary, fill, stroke, center_lon, center_lat, zoom, hero_url, kind,
            content_status
       from special_regions order by name`,
    "select slug, name, label, note, fill, stroke, geometry from map_areas order by name",
    "select slug, updated_at from special_regions",
    "select id, updated_at from indicators",
    `select position, title, summary_points, body_html, illustration_url, illustration_credit, audio_url,
            tile_background, updated_at
       from entry_chapters`,
    "select id, position, title, illustration_url, tile_background, created_at from entry_chapters",
  ];
  await as(null, async () => {
    for (const sql of queries) assert.equal((await q(sql)).length, 1, sql);
    // The public RPCs that read these tables as the caller.
    await q("select * from search('climate')");
    await q("select portrait('issue', 'climate')");
  });
});

// ---------------------------------------------------------------------------
// Signed-in readers (self-registered accounts, not the team)
// ---------------------------------------------------------------------------

test("readers: the map data's internal columns are refused, the public ones readable", async () => {
  await as(id.reader, async () => {
    for (const table of OPEN_TO_SIGNED_IN) {
      for (const column of INTERNAL[table]) {
        await refused(q(`select ${column} from ${table}`), /permission denied/);
      }
      assert.equal((await q(`select ${PUBLIC[table]} from ${table}`)).length, 1, table);
    }
  });
});

test("readers: entries and subtopics show them no team metadata", async () => {
  // The columns stay granted to `authenticated` (the team reads them through the
  // same role), so RLS keeps readers away from the rows: no entry, no subtopic.
  await as(id.reader, async () => {
    const entries = await q(
      "select owner_id, approved_by, updated_by, scheduled_by, review_note from entries where id = $1",
      [entry],
    );
    assert.equal(entries.length, 0);
    const chapters = await q("select created_by, updated_by from entry_chapters where id = $1", [
      chapter,
    ]);
    assert.equal(chapters.length, 0);
  });
});

// ---------------------------------------------------------------------------
// The team (staff)
// ---------------------------------------------------------------------------

test("staff: the dossier editor still reads who created and changed each subtopic", async () => {
  for (const member of [id.admin, id.editor, id.dataEditor]) {
    const row = await as(member, () =>
      one(
        // getEntryParts() in features/entries/editorial.ts
        `select id, title, summary_points, body_html, illustration_url, illustration_credit, audio_url,
                tile_background, created_at, created_by, updated_at, updated_by
           from entry_chapters where entry_id = $1 order by position`,
        [entry],
      ),
    );
    assert.equal(row?.created_by, id.editor);
    assert.equal(row?.updated_by, id.editor);
  }
  // Team metadata of the entry itself stays with the team (20261008000030).
  const meta = await as(id.dataEditor, () =>
    one("select owner_id, updated_by from entries where id = $1", [entry]),
  );
  assert.equal(meta?.owner_id, id.editor);
});

test("staff: saving subtopics keeps the creator of an unchanged one (reads it as the caller)", async () => {
  await as(id.admin, () =>
    q("select replace_entry_parts($1, 'chapters', $2::jsonb)", [
      entry,
      JSON.stringify([{ id: chapter, title: "First topic" }, { title: "Second topic" }]),
    ]),
  );
  const rows = await q(
    "select title, created_by from entry_chapters where entry_id = $1 order by position",
    [entry],
  );
  assert.deepEqual(rows, [
    { title: "First topic", created_by: id.editor },
    { title: "Second topic", created_by: id.admin },
  ]);
});

test("staff: the admin's reads and writes of map data still work", async () => {
  await as(id.dataEditor, async () => {
    // indicatorForEdit() in features/indicators/editorial.ts
    await q(`select id, label, short_label, description, unit, decimals, source, source_url, type, scale,
                    domain_min, domain_max, ramp, higher_is_better, is_custom, latest_year
               from indicators where id = 'hdi'`);
    await q(`select country_iso3, value, year, note, source_note, is_manual, updated_at
               from indicator_values where indicator_id = 'hdi' order by country_iso3`);
    // issueForEdit() in features/portraits/editorial.ts
    await q(`select slug, kind, name, subtitle, summary, intro, hero_url, hero_credit, fill, stroke,
                    center_lon, center_lat, zoom, timeline_title, timeline_subtitle, content_status
               from special_regions where slug = 'climate'`);

    // saveIndicator / setValue / saveIssue (features/*/actions.ts), as PostgREST sends them.
    await q(`insert into indicators (id, label, domain_min, domain_max, is_custom)
             values ('custom', 'Custom', 0, 1, true)`);
    const updated = await q(
      "update indicators set label = 'HDI (UNDP)' where id = 'hdi' returning id",
    );
    assert.equal(updated.length, 1);
    await q(`insert into indicator_values (indicator_id, country_iso3, value, source_note)
             values ('hdi', 'JPN', 0.93, 'UNDP HDR 2026')
             on conflict (indicator_id, country_iso3)
             do update set value = excluded.value, source_note = excluded.source_note`);
    await q(`insert into special_regions (slug, name, fill, stroke, center_lon, center_lat)
             values ('oceans', 'Oceans', '#336699', '#224466', 0, 0)`);
    const issue = await q(
      "update special_regions set summary = 'Seas' where slug = 'oceans' returning slug",
    );
    assert.equal(issue.length, 1);
  });

  await as(id.admin, async () => {
    // getArea() in features/map/editorial.ts and saveArea / deleteArea.
    await q(`select slug, name, label, note, fill, stroke, country_iso3, geometry
               from map_areas where slug = 'hawaii'`);
    await q(
      `insert into map_areas (slug, name, fill, stroke, geometry, created_by)
       values ('kauai', 'Kauai', '#4fb3a5', '#1f7166', $1, $2)`,
      [hawaii, id.admin],
    );
    const moved = await q(
      "update map_areas set label = 'Kauaʻi' where slug = 'kauai' returning slug",
    );
    assert.equal(moved.length, 1);
    const gone = await q("delete from map_areas where slug = 'kauai' returning slug");
    assert.equal(gone.length, 1);
  });

  // The rows are still stamped by the database, just not readable by the public.
  const stamps = await one(`select
      (select created_by from indicators where id = 'custom') as indicator,
      (select updated_by from indicator_values where indicator_id = 'hdi' and country_iso3 = 'JPN') as value,
      (select created_by from special_regions where slug = 'oceans') as issue`);
  assert.deepEqual(stamps, {
    indicator: id.dataEditor,
    value: id.dataEditor,
    issue: id.dataEditor,
  });
});
