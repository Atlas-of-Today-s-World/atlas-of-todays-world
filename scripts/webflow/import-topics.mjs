#!/usr/bin/env node
/**
 * Imports the Global Issues topics scraped from the old site
 * (scrape-global-issues.mjs) as published topics (encyclopedia entries).
 *
 *   node scripts/webflow/import-topics.mjs [--data scripts/webflow/data/global-issues.json]
 *        [--apply --project dev|prod] [--demo-places] [--env .env.local]
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
 * --demo-places (atlas-dev only) puts a few topics on the map so the topic
 * counts can be tried out; real placements are an editorial decision.
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

/** Demo placements for atlas-dev: a region topic, a country topic, issue topics. */
const DEMO_PLACES = {
  "international-law-mechanisms-related-to-refugees": { region_slug: "western-central-europe" },
  "detention-of-migrants-and-refugees": { countries: ["CZE"] },
  "migrant-smuggling": { special_slug: "migration-routes", countries: ["LBY", "ITA", "GRC"] },
  "types-of-migrants": { special_slug: "forced-displacement" },
  "disaster-risk-reduction-and-climate-change-adaptation": { special_slug: "climate-frontlines" },
  "connections-between-biodiversity-and-climate-change": { special_slug: "climate-frontlines" },
  "international-humanitarian-law-and-the-conduct-of-war": { special_slug: "russia-ukraine-war" },
  "gender-equality-and-poverty": { region_slug: "sub-saharan-africa" },
};

const { values: args } = parseArgs({
  options: {
    data: { type: "string", default: "scripts/webflow/data/global-issues.json" },
    apply: { type: "boolean", default: false },
    project: { type: "string" },
    "demo-places": { type: "boolean", default: false },
    env: { type: "string", default: ".env.local" },
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
    redirect: { from_path: topic.oldPath, to_path: `/entry/${topic.slug}`, permanent: true },
  };
}

const plans = topics.map((topic) => ({ topic, ...plan(topic) }));
for (const item of plans) {
  console.log(
    `${item.entry.slug}: ${item.chapters.length} articles, ${item.links.length} links` +
      (item.skipped.length ? `, ${item.skipped.length} skipped (not https)` : ""),
  );
}
if (!args.apply) {
  console.log(`\nDry run — ${plans.length} topics, nothing written. Live: --apply --project dev`);
  process.exit(0);
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
if (args["demo-places"] && args.project !== "dev") {
  console.error("Refused: demo placements are for atlas-dev only.");
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

  const places = args["demo-places"] ? (DEMO_PLACES[entry.slug] ?? {}) : {};
  const { countries = [], ...placement } = places;
  const saved = must(
    await db
      .from("entries")
      .upsert(
        {
          ...entry,
          ...placement,
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

  if (args["demo-places"]) {
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
