#!/usr/bin/env node
/**
 * Imports the Global Issues topics scraped from the old site
 * (scrape-global-issues.mjs) as published topics (encyclopedia entries).
 *
 *   node scripts/webflow/import-topics.mjs [--data scripts/webflow/data/global-issues.json]
 *        [--apply --project dev|prod] [--replace-places] [--sql <file>] [--env .env.local]
 *
 * Without --apply it is a DRY RUN and prints what would be written.
 * With --apply it writes with the service key into the project whose ref must
 * match --project (production only with an explicit --project prod):
 *   - the author profile (found by name, else created),
 *   - the topic (upsert by slug): header, articles (chapters) with photos,
 *     links in the tiles of the default template, published as on the old site,
 *   - a redirect from the old address /articles-global-issues/<slug>.
 * Images move from the Webflow CDN to Storage (a name derived from the URL, so
 * a repeated run re-uses them). Repeatable: a topic's articles and links are
 * replaced whole, its tiles keep what editors changed.
 *
 * Places on the map (PLACES) are filled in only where a topic has none yet,
 * so a repeated run never undoes an editor's choice; --replace-places
 * overwrites them (atlas-dev, where demo placements used to sit).
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { parseArgs } from "node:util";

const PROJECTS = { dev: "bognwszwhxxyjafqzfuh", prod: "ewbzkxialhtwuqlenjof" };
const IMAGE_BUCKET = "entry-images";
const IMAGE_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

/** Old resource section → tile of the Standard template. */
const TILE_SLUG = {
  "Videos & Documentaries": "videos",
  "Stats, Databases & Infographics": "stats",
  "Articles, Reports & Books": "reading",
  "Educational Resources": "education",
  "Lectures & Debates": "lectures",
};

/** Lens of the old Global Issues page → the closest Atlas category. */
const CATEGORY = {
  Migration: "Society",
  "Poverty, Inequality and Sustainable Development": "Living Conditions",
  "Climate Change and Its Impacts": "Living Conditions",
  "Human Rights": "Political System",
  "Active War Zones and Regions in Need of Humanitarian Aid": "International Relations",
  "Globalization: The Connection and Disconnection of Worlds": "International Relations",
};

/**
 * Where each topic sits on the map, read from its text (the countries and
 * regions it discusses) and its subject (the global issue it belongs to).
 * Topics about the world as a whole stay without a place. Editors change it
 * in the admin; the import only fills empty places.
 */
const PLACES = {
  "detention-of-migrants-and-refugees": {
    region_slug: "western-central-europe",
    special_slug: "forced-displacement",
    countries: ["CZE"],
  },
  "types-of-migrants": { special_slug: "forced-displacement", countries: ["SYR", "LBN", "PSE"] },
  "migrant-smuggling": {
    special_slug: "migration-routes",
    countries: ["MEX", "LBY", "TUR", "GRC", "NER"],
  },
  "international-law-mechanisms-related-to-refugees": { special_slug: "forced-displacement" },
  "gender-equality-and-poverty": { region_slug: "western-central-europe" },
  "the-state-of-inequality-within-minority-groups": {
    region_slug: "western-central-europe",
    countries: ["HUN", "ROU", "FIN", "SWE"],
  },
  "climate-change-challenges-to-combating-climate-change-at-the-individual-regional-and-global-level":
    { special_slug: "climate-frontlines" },
  "disaster-risk-reduction-and-climate-change-adaptation": {
    special_slug: "climate-frontlines",
    countries: ["IND", "BGD", "PAK"],
  },
  "connections-between-biodiversity-and-climate-change": {
    special_slug: "climate-frontlines",
    countries: ["BRA"],
  },
  "political-ideologies-and-their-perspectives-on-human-rights": {
    region_slug: "western-central-europe",
    countries: ["IRL", "FRA", "ITA", "GBR"],
  },
  "human-rights-violations-and-advocacy": { countries: ["COL", "GTM", "RWA", "MMR", "BDI"] },
  "international-humanitarian-law-and-the-conduct-of-war": {
    region_slug: "middle-east-north-africa",
    countries: ["IRQ", "IRN", "ISR", "PSE"],
  },
  "the-role-of-international-organisations-in-peace-and-conflict": {
    special_slug: "russia-ukraine-war",
    countries: ["UKR", "SDN", "COG"],
  },
  "ethics-and-practices-of-humanitarian-intervention": {
    countries: ["XKX", "BIH", "COD", "HTI", "SLE"],
  },
  "the-rise-of-non-state-actors-in-the-20th-and-21st-century": {
    countries: ["IRQ", "AFG", "QAT", "COL"],
  },
};

const { values: args } = parseArgs({
  options: {
    data: { type: "string", default: "scripts/webflow/data/global-issues.json" },
    apply: { type: "boolean", default: false },
    project: { type: "string" },
    "replace-places": { type: "boolean", default: false },
    env: { type: "string", default: ".env.local" },
    sql: { type: "string" },
  },
});

const { topics } = JSON.parse(readFileSync(args.data, "utf8"));
const clip = (value, max) => (value ?? "").trim().slice(0, max);
/** Whole sentences up to `max` characters (a summary never stops mid-word). */
function sentences(value, max) {
  const text = (value ?? "").trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
  return end > 80 ? cut.slice(0, end + 1) : `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}
const cleanAuthor = (value) => clip(value.replace(/\s*\(In Progress\)\s*$/i, ""), 120);
const https = (url) => (url ?? "").trim().replace(/^http:\/\//, "https://");

function publishedOn(text) {
  const date = new Date(`${text} 12:00 UTC`);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString().slice(0, 10);
}

/** Everything one topic writes, without touching the database. */
function plan(topic) {
  const links = [];
  const skipped = [];
  for (const section of topic.learnMore) {
    const tile = TILE_SLUG[section.label];
    for (const link of section.links) {
      const url = https(link.url);
      if (!tile || !/^https:\/\/[^\s]+$/.test(url)) {
        skipped.push(link.url);
        continue;
      }
      links.push({
        tile,
        title: clip(link.title, 200) || "Link",
        source: clip(link.source, 120),
        description: clip(link.description, 600),
        url: url.slice(0, 1000),
      });
    }
  }
  const author = cleanAuthor(topic.author);
  return {
    entry: {
      slug: topic.slug.slice(0, 120),
      locale: "en",
      kind: "entry",
      title: clip(topic.title, 200),
      summary: sentences(topic.chapters[0]?.teaser || topic.summaryPoints.join(" "), 600),
      summary_points: topic.summaryPoints.slice(0, 5).map((point) => clip(point, 300)),
      category: CATEGORY[topic.lens] ?? "Society",
      cover_url: topic.hero ? https(topic.hero) : null,
      cover_credit: clip(topic.heroCredit, 300) || null,
      author_name: author || null,
      status: "published",
      published_on: publishedOn(topic.updated),
      body_html: "",
      seo_keywords: topic.lens ? [clip(topic.lens, 60)] : [],
    },
    author: author
      ? {
          name: author,
          bio: clip(topic.authorBio, 2000),
          positionality: clip(topic.positionality, 2000),
          photo_url: topic.authorPhoto ? https(topic.authorPhoto) : null,
        }
      : null,
    chapters: topic.chapters.slice(0, 12).map((chapter, position) => ({
      position,
      title: clip(chapter.title, 200),
      summary_points: chapter.teaser ? [clip(chapter.teaser, 300)] : [],
      body_html: chapter.bodyHtml,
      illustration_url: chapter.tileImage ? https(chapter.tileImage) : null,
      illustration_credit: clip(chapter.imageCredit, 300) || null,
    })),
    links: links.slice(0, 200),
    skipped,
    redirect: { from_path: topic.oldPath, to_path: `/topics/${topic.slug}`, permanent: true },
  };
}

const plans = topics.map((topic) => ({ topic, ...plan(topic) }));
for (const item of plans) {
  console.log(
    `${item.entry.slug}: ${item.chapters.length} articles, ${item.links.length} links` +
      (item.skipped.length ? `, ${item.skipped.length} skipped (not https)` : ""),
  );
}
if (args.sql) {
  await writeSql(args.sql);
  process.exit(0);
}
if (!args.apply) {
  console.log(`\nDry run — ${plans.length} topics, nothing written. Live: --apply --project dev`);
  process.exit(0);
}

/**
 * The same import as one SQL transaction (for psql as the database owner),
 * when no service key is at hand. Images keep their Webflow addresses; a later
 * run with --apply moves them to Storage.
 */
async function writeSql(file) {
  const replace = args["replace-places"] ? "true" : "false";
  const { writeFileSync } = await import("node:fs");
  const { sanitizeRichHtml } = await import("../../src/lib/security/sanitize.ts");
  const blocks = plans.map(({ entry, author, chapters, links, redirect }) => {
    const payload = JSON.stringify({
      entry,
      author,
      place: PLACES[entry.slug] ?? null,
      chapters: chapters.map((chapter) => ({
        ...chapter,
        body_html: sanitizeRichHtml(chapter.body_html),
      })),
      links,
      redirect,
    });
    if (payload.includes("$topic$"))
      throw new Error(`${entry.slug}: payload contains the quote tag`);
    return `do $do$
declare
  p jsonb := $topic$${payload}$topic$::jsonb;
  e jsonb := p -> 'entry';
  v_author uuid;
  v_entry uuid;
begin
  if p -> 'author' <> 'null'::jsonb then
    select id into v_author from authors where name = p -> 'author' ->> 'name' limit 1;
    if v_author is null then
      insert into authors (name, bio, positionality, photo_url, slug)
      values (p -> 'author' ->> 'name', p -> 'author' ->> 'bio', p -> 'author' ->> 'positionality',
              p -> 'author' ->> 'photo_url', '')
      returning id into v_author;
    else
      update authors set bio = p -> 'author' ->> 'bio', positionality = p -> 'author' ->> 'positionality',
                         photo_url = p -> 'author' ->> 'photo_url'
       where id = v_author;
    end if;
  end if;

  insert into entries (slug, locale, kind, title, summary, summary_points, category, cover_url, cover_credit,
                       author_name, author_id, status, published_on, body_html, seo_keywords)
  values (e ->> 'slug', 'en', 'entry', e ->> 'title', e ->> 'summary',
          array(select jsonb_array_elements_text(e -> 'summary_points')), e ->> 'category',
          e ->> 'cover_url', e ->> 'cover_credit', e ->> 'author_name', v_author, 'published',
          (e ->> 'published_on')::date, '', array(select jsonb_array_elements_text(e -> 'seo_keywords')))
  on conflict (slug, locale) do update set
    title = excluded.title, summary = excluded.summary, summary_points = excluded.summary_points,
    category = excluded.category, cover_url = excluded.cover_url, cover_credit = excluded.cover_credit,
    author_name = excluded.author_name, author_id = excluded.author_id, status = 'published',
    published_on = excluded.published_on, seo_keywords = excluded.seo_keywords
  returning id into v_entry;

  delete from entry_chapters where entry_id = v_entry;
  insert into entry_chapters (entry_id, position, title, summary_points, body_html, illustration_url, illustration_credit)
  select v_entry, (c ->> 'position')::int, c ->> 'title',
         array(select jsonb_array_elements_text(c -> 'summary_points')), c ->> 'body_html',
         c ->> 'illustration_url', c ->> 'illustration_credit'
    from jsonb_array_elements(p -> 'chapters') c;

  -- Tiles come from the default template when the topic is created.
  delete from resources where entry_id = v_entry;
  insert into resources (entry_id, position, tile_id, title, source, description, url)
  select v_entry, (ord - 1)::int, t.id, l ->> 'title', l ->> 'source', l ->> 'description', l ->> 'url'
    from jsonb_array_elements(p -> 'links') with ordinality as x(l, ord)
    join learn_more_tiles t on t.entry_id = v_entry and t.slug = l ->> 'tile';

  -- A place on the map only where the topic has none yet (editors decide later).
  if p -> 'place' <> 'null'::jsonb
     and (${replace} or ((select region_slug is null and special_slug is null from entries where id = v_entry)
         and not exists (select 1 from entry_countries where entry_id = v_entry))) then
    update entries set region_slug = p -> 'place' ->> 'region_slug', special_slug = p -> 'place' ->> 'special_slug'
     where id = v_entry;
    delete from entry_countries where entry_id = v_entry;
    insert into entry_countries (entry_id, country_iso3)
    select v_entry, c from jsonb_array_elements_text(coalesce(p -> 'place' -> 'countries', '[]')) c;
  end if;

  insert into redirects (from_path, to_path, permanent)
  values (p -> 'redirect' ->> 'from_path', p -> 'redirect' ->> 'to_path', true)
  on conflict (from_path) do update set to_path = excluded.to_path;
  raise notice 'imported %', e ->> 'slug';
end
$do$;`;
  });
  writeFileSync(file, `begin;\n${blocks.join("\n\n")}\ncommit;\n`);
  console.log(`\nSQL for ${plans.length} topics → ${file}`);
}

// ---------------------------------------------------------------------------
// Writing (only with --apply)
// ---------------------------------------------------------------------------

const env = { ...readEnvFile(args.env), ...process.env };
const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const expected = PROJECTS[args.project];
if (!expected || !url.includes(`${expected}.supabase.co`)) {
  console.error(
    `Refused: --project ${args.project ?? "(missing)"} doesn't match the Supabase URL.`,
  );
  process.exit(2);
}
if (!env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(2);
}

const { createClient } = await import("@supabase/supabase-js");
const { sanitizeRichHtml } = await import("../../src/lib/security/sanitize.ts");
const db = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

/** A Webflow image → Storage (smaller "-p-1600" rendition first); null keeps the original link. */
const moved = new Map();
async function moveImage(source) {
  if (!source) return null;
  if (moved.has(source)) return moved.get(source);
  const candidates = [source.replace(/(\.[a-z]+)$/i, "-p-1600$1"), source];
  let result = source;
  for (const candidate of candidates) {
    const response = await fetch(candidate);
    const type = (response.headers.get("content-type") ?? "").split(";")[0];
    if (!response.ok || !IMAGE_TYPES[type]) continue;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > MAX_IMAGE_BYTES) continue;
    const name = `import/webflow/${createHash("sha1").update(source).digest("hex")}.${IMAGE_TYPES[type]}`;
    // Storage sometimes answers 502 under load: three tries before giving up.
    for (let attempt = 1; ; attempt += 1) {
      const { error } = await db.storage
        .from(IMAGE_BUCKET)
        .upload(name, bytes, { contentType: type, upsert: true });
      if (!error) break;
      if (attempt === 3) throw new Error(`Storage ${name}: ${error.message}`);
      await new Promise((done) => setTimeout(done, 2000 * attempt));
    }
    result = db.storage.from(IMAGE_BUCKET).getPublicUrl(name).data.publicUrl;
    break;
  }
  moved.set(source, result);
  return result;
}

const must = (result, what) => {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data;
};

for (const item of plans) {
  const { entry, author, chapters, links, redirect } = item;
  let authorId = null;
  if (author) {
    const found = must(
      await db.from("authors").select("id").eq("name", author.name).limit(1),
      `author ${author.name}`,
    );
    const row = { ...author, photo_url: await moveImage(author.photo_url) };
    authorId = found[0]?.id
      ? must(
          await db.from("authors").update(row).eq("id", found[0].id).select("id").single(),
          "author",
        ).id
      : must(await db.from("authors").insert(row).select("id").single(), "author").id;
  }

  const saved = must(
    await db
      .from("entries")
      .upsert(
        {
          ...entry,
          author_id: authorId,
          cover_url: await moveImage(entry.cover_url),
        },
        { onConflict: "slug,locale" },
      )
      .select("id")
      .single(),
    `entry ${entry.slug}`,
  );
  const id = saved.id;

  const place = PLACES[entry.slug];
  const current = must(
    await db
      .from("entries")
      .select("region_slug, special_slug, entry_countries(country_iso3)")
      .eq("id", id)
      .single(),
    "place",
  );
  const empty = !current.region_slug && !current.special_slug && !current.entry_countries.length;
  if (place && (empty || args["replace-places"])) {
    const { countries = [], region_slug = null, special_slug = null } = place;
    must(await db.from("entries").update({ region_slug, special_slug }).eq("id", id), "place");
    must(await db.from("entry_countries").delete().eq("entry_id", id), "countries");
    if (countries.length) {
      must(
        await db
          .from("entry_countries")
          .insert(countries.map((country_iso3) => ({ entry_id: id, country_iso3 }))),
        "countries",
      );
    }
  }

  must(await db.from("entry_chapters").delete().eq("entry_id", id), "chapters");
  const rows = [];
  for (const chapter of chapters) {
    rows.push({
      ...chapter,
      entry_id: id,
      body_html: sanitizeRichHtml(chapter.body_html),
      illustration_url: await moveImage(chapter.illustration_url),
    });
  }
  must(await db.from("entry_chapters").insert(rows), `chapters ${entry.slug}`);

  // Tiles come from the default template when the topic is created.
  const tiles = must(
    await db.from("learn_more_tiles").select("id, slug").eq("entry_id", id),
    "tiles",
  );
  const tileId = Object.fromEntries(tiles.map((tile) => [tile.slug, tile.id]));
  must(await db.from("resources").delete().eq("entry_id", id), "resources");
  const resources = links
    .filter((link) => tileId[link.tile])
    .map(({ tile, ...link }, position) => ({
      ...link,
      entry_id: id,
      tile_id: tileId[tile],
      position,
    }));
  if (resources.length) must(await db.from("resources").insert(resources), `links ${entry.slug}`);

  must(await db.from("redirects").upsert(redirect, { onConflict: "from_path" }), "redirect");
  console.log(`✓ ${entry.slug}`);
}

console.log(`\nWritten to ${args.project}: ${plans.length} topics, ${moved.size} images.`);

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((line) => /^[A-Z_][A-Z0-9_]*=/.test(line))
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
  );
}
