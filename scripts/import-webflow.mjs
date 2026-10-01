#!/usr/bin/env node
/**
 * Content import from the old Webflow site (PLAN G7, brief P16).
 *
 *   node scripts/import-webflow.mjs --dir <export directory>
 *        [--config scripts/webflow/mapping.config.mjs]
 *        [--apply --project dev|prod] [--env .env.local]
 *
 * Without --apply it is a DRY RUN: reads the export, maps it and prints what would
 * be written (counts, missing files, skipped items, images to download).
 * It touches neither the database nor Storage.
 *
 * With --apply it writes with the service key (ARCHITEKTURA 2.4 — imports) into the
 * project whose ref must match --project; production only with an explicit --project prod.
 * The import is repeatable: portrait sections are replaced whole (replace_portrait_items,
 * one transaction), entries and redirects are upserted by slug / old path, and
 * images from the Webflow CDN are uploaded to Storage under a name derived from their URL.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import {
  buildRedirects,
  mapCollection,
  PORTRAIT_COLLECTIONS,
  readItems,
  rewriteFiles,
  webflowFiles,
} from "./webflow/core.mjs";

const PROJECTS = { dev: "bognwszwhxxyjafqzfuh", prod: "ewbzkxialhtwuqlenjof" };
const IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};
const IMAGE_BUCKET = "entry-images";

const { values: args } = parseArgs({
  options: {
    dir: { type: "string" },
    config: { type: "string", default: "scripts/webflow/mapping.config.mjs" },
    apply: { type: "boolean", default: false },
    project: { type: "string" },
    env: { type: "string", default: ".env.local" },
  },
});

if (!args.dir) {
  console.error(
    "Usage: node scripts/import-webflow.mjs --dir <export directory> [--apply --project dev|prod]",
  );
  process.exit(2);
}

const config = (await import(pathToFileURL(resolve(args.config)).href)).default;

// ---------------------------------------------------------------------------
// 1. Reading and mapping (dry run and live)
// ---------------------------------------------------------------------------

const itemsByCollection = new Map();
const plan = { portraits: new Map(), entries: [], regions: [] };
const warnings = [];

for (const collection of config.collections) {
  const file = resolve(args.dir, collection.file);
  const alternative = file.replace(/\.csv$/, ".json");
  const path = existsSync(file) ? file : existsSync(alternative) ? alternative : null;
  if (!path) {
    warnings.push(`${collection.name}: file ${collection.file} missing from export — skipped`);
    continue;
  }
  const items = readItems(readFileSync(path, "utf8"), extname(path) === ".json" ? "json" : "csv");
  itemsByCollection.set(collection.name, items);
  const { rows, skipped } = mapCollection(items, collection);
  if (skipped.length)
    warnings.push(
      `${collection.name}: skipped ${skipped.length} (${skipped.slice(0, 5).join(", ")}…)`,
    );
  console.log(`${collection.name}: ${items.length} položek → ${rows.length} řádků`);

  const target = collection.target;
  if (target.type === "portrait") {
    if (!PORTRAIT_COLLECTIONS.includes(target.collection))
      throw new Error(`${collection.name}: unknown section ${target.collection}`);
    // Several collections into one section (resources + videos) are combined — the section is replaced whole.
    const key = `${target.kind}:${target.slug}:${target.collection}`;
    plan.portraits.set(key, [...(plan.portraits.get(key) ?? []), ...rows]);
  } else if (target.type === "entries") {
    plan.entries.push(...rows);
  } else if (target.type === "region") {
    if (rows.length) plan.regions.push({ slug: target.slug, fields: rows[0] });
  } else throw new Error(`${collection.name}: unknown target ${target.type}`);
}

const redirects = buildRedirects(config, itemsByCollection);
const files = new Set(
  [...plan.portraits.values(), plan.entries, plan.regions.map((region) => region.fields)]
    .flat()
    .flatMap((row) => Object.values(row).flatMap(webflowFiles)),
);

console.log(
  `\nPlan: ${plan.portraits.size} portrait sections, ${plan.entries.length} entries, ` +
    `${plan.regions.length} region headers, ${redirects.length} redirects, ${files.size} files from Webflow CDN.`,
);
for (const warning of warnings) console.warn(`⚠ ${warning}`);

if (!args.apply) {
  console.log("\nNanečisto — nic se nezapsalo. Naostro: --apply --project dev");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// 2. Writing (only with --apply)
// ---------------------------------------------------------------------------

const env = { ...readEnvFile(args.env), ...process.env };
const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const expected = PROJECTS[args.project];
if (!expected || !url.includes(`${expected}.supabase.co`)) {
  console.error(
    `Zápis odmítnut: --project ${args.project ?? "(chybí)"} neodpovídá ${url || "NEXT_PUBLIC_SUPABASE_URL"}.`,
  );
  process.exit(2);
}
if (!env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(2);
}

const { createClient } = await import("@supabase/supabase-js");
const { sanitizeRichHtml } = await import("../src/lib/security/sanitize.ts");
const db = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// Files from Webflow CDN → Storage (name from the URL hash = repeatable).
const moved = new Map();
for (const file of files) {
  const response = await fetch(file);
  const type = (response.headers.get("content-type") ?? "").split(";")[0];
  if (!response.ok || !IMAGE_TYPES[type]) {
    warnings.push(`file ${file} cannot be transferred (${response.status} ${type}) — link kept`);
    continue;
  }
  const name = `import/webflow/${createHash("sha1").update(file).digest("hex")}.${IMAGE_TYPES[type]}`;
  const { error } = await db.storage
    .from(IMAGE_BUCKET)
    .upload(name, Buffer.from(await response.arrayBuffer()), { contentType: type, upsert: true });
  if (error) throw new Error(`Storage ${name}: ${error.message}`);
  moved.set(file, db.storage.from(IMAGE_BUCKET).getPublicUrl(name).data.publicUrl);
}
const relink = (row) =>
  Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      typeof value === "string" ? rewriteFiles(value, moved) : value,
    ]),
  );

for (const region of plan.regions) {
  const { error } = await db.from("regions").update(relink(region.fields)).eq("slug", region.slug);
  if (error) throw new Error(`region ${region.slug}: ${error.message}`);
}

for (const [key, rows] of plan.portraits) {
  const [kind, slug, collection] = key.split(":");
  const { error } = await db.rpc("replace_portrait_items", {
    p_kind: kind,
    p_slug: slug,
    p_collection: collection,
    p_items: rows.slice(0, 50).map(relink),
  });
  if (error) throw new Error(`${key}: ${error.message}`);
  if (rows.length > 50)
    warnings.push(`${key}: section has ${rows.length} items, saved the first 50`);
}

for (const { countries = [], ...row } of plan.entries) {
  const entry = relink({ ...row, body_html: sanitizeRichHtml(row.body_html ?? "") });
  const { data, error } = await db
    .from("entries")
    .upsert({ locale: "en", ...entry }, { onConflict: "slug,locale" })
    .select("id")
    .single();
  if (error) throw new Error(`entry ${row.slug}: ${error.message}`);
  await db.from("entry_countries").delete().eq("entry_id", data.id);
  if (countries.length) {
    const { error: countryError } = await db
      .from("entry_countries")
      .insert(countries.map((country_iso3) => ({ entry_id: data.id, country_iso3 })));
    if (countryError) throw new Error(`entry countries ${row.slug}: ${countryError.message}`);
  }
}

if (redirects.length) {
  const { error } = await db.from("redirects").upsert(redirects, { onConflict: "from_path" });
  if (error) throw new Error(`redirects: ${error.message}`);
}

console.log(`\nWritten to ${args.project}. Transferred ${moved.size} files.`);
for (const warning of warnings) console.warn(`⚠ ${warning}`);
console.log("The site refreshes within an hour (cache), or immediately after a new deployment.");

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((line) => /^[A-Z_][A-Z0-9_]*=/.test(line))
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
  );
}
