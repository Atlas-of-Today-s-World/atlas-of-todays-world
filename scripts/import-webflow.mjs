#!/usr/bin/env node
/**
 * Import obsahu ze starého webu na Webflow (PLAN G7, brief P16).
 *
 *   node scripts/import-webflow.mjs --dir <adresář exportu>
 *        [--config scripts/webflow/mapping.config.mjs]
 *        [--apply --project dev|prod] [--env .env.local]
 *
 * Bez --apply běží NANEČISTO: přečte export, namapuje ho a vypíše, co by se
 * zapsalo (počty, chybějící soubory, přeskočené položky, obrázky ke stažení).
 * Do databáze ani Storage nesáhne.
 *
 * S --apply zapisuje servisním klíčem (ARCHITEKTURA 2.4 — importy) do projektu,
 * jehož ref musí odpovídat --project; do produkce jen s výslovným --project prod.
 * Import je opakovatelný: sekce portrétu se nahrazují celé (replace_portrait_items,
 * jedna transakce), články a přesměrování se upsertují podle slugu / staré cesty,
 * obrázky z Webflow CDN se nahrají do Storage pod jménem odvozeným z jejich URL.
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
    "Použití: node scripts/import-webflow.mjs --dir <adresář exportu> [--apply --project dev|prod]",
  );
  process.exit(2);
}

const config = (await import(pathToFileURL(resolve(args.config)).href)).default;

// ---------------------------------------------------------------------------
// 1. Čtení a mapování (nanečisto i naostro)
// ---------------------------------------------------------------------------

const itemsByCollection = new Map();
const plan = { portraits: new Map(), entries: [], regions: [] };
const warnings = [];

for (const collection of config.collections) {
  const file = resolve(args.dir, collection.file);
  const alternative = file.replace(/\.csv$/, ".json");
  const path = existsSync(file) ? file : existsSync(alternative) ? alternative : null;
  if (!path) {
    warnings.push(`${collection.name}: soubor ${collection.file} v exportu chybí — přeskočeno`);
    continue;
  }
  const items = readItems(readFileSync(path, "utf8"), extname(path) === ".json" ? "json" : "csv");
  itemsByCollection.set(collection.name, items);
  const { rows, skipped } = mapCollection(items, collection);
  if (skipped.length)
    warnings.push(
      `${collection.name}: přeskočeno ${skipped.length} (${skipped.slice(0, 5).join(", ")}…)`,
    );
  console.log(`${collection.name}: ${items.length} položek → ${rows.length} řádků`);

  const target = collection.target;
  if (target.type === "portrait") {
    if (!PORTRAIT_COLLECTIONS.includes(target.collection))
      throw new Error(`${collection.name}: neznámá sekce ${target.collection}`);
    // Víc kolekcí do jedné sekce (zdroje + videa) se spojí — sekce se nahrazuje celá.
    const key = `${target.kind}:${target.slug}:${target.collection}`;
    plan.portraits.set(key, [...(plan.portraits.get(key) ?? []), ...rows]);
  } else if (target.type === "entries") {
    plan.entries.push(...rows);
  } else if (target.type === "region") {
    if (rows.length) plan.regions.push({ slug: target.slug, fields: rows[0] });
  } else throw new Error(`${collection.name}: neznámý cíl ${target.type}`);
}

const redirects = buildRedirects(config, itemsByCollection);
const files = new Set(
  [...plan.portraits.values(), plan.entries, plan.regions.map((region) => region.fields)]
    .flat()
    .flatMap((row) => Object.values(row).flatMap(webflowFiles)),
);

console.log(
  `\nPlán: ${plan.portraits.size} sekcí portrétů, ${plan.entries.length} článků, ` +
    `${plan.regions.length} hlaviček regionů, ${redirects.length} přesměrování, ${files.size} souborů z Webflow CDN.`,
);
for (const warning of warnings) console.warn(`⚠ ${warning}`);

if (!args.apply) {
  console.log("\nNanečisto — nic se nezapsalo. Naostro: --apply --project dev");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// 2. Zápis (jen s --apply)
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
  console.error("Chybí SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(2);
}

const { createClient } = await import("@supabase/supabase-js");
const { sanitizeRichHtml } = await import("../src/lib/security/sanitize.ts");
const db = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// Soubory z Webflow CDN → Storage (jméno podle hashe URL = opakovatelné).
const moved = new Map();
for (const file of files) {
  const response = await fetch(file);
  const type = (response.headers.get("content-type") ?? "").split(";")[0];
  if (!response.ok || !IMAGE_TYPES[type]) {
    warnings.push(`soubor ${file} nejde přenést (${response.status} ${type}) — zůstává odkaz`);
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
    warnings.push(`${key}: sekce má ${rows.length} položek, uloženo prvních 50`);
}

for (const { countries = [], ...row } of plan.entries) {
  const entry = relink({ ...row, body_html: sanitizeRichHtml(row.body_html ?? "") });
  const { data, error } = await db
    .from("entries")
    .upsert({ locale: "en", ...entry }, { onConflict: "slug,locale" })
    .select("id")
    .single();
  if (error) throw new Error(`článek ${row.slug}: ${error.message}`);
  await db.from("entry_countries").delete().eq("entry_id", data.id);
  if (countries.length) {
    const { error: countryError } = await db
      .from("entry_countries")
      .insert(countries.map((country_iso3) => ({ entry_id: data.id, country_iso3 })));
    if (countryError) throw new Error(`země článku ${row.slug}: ${countryError.message}`);
  }
}

if (redirects.length) {
  const { error } = await db.from("redirects").upsert(redirects, { onConflict: "from_path" });
  if (error) throw new Error(`přesměrování: ${error.message}`);
}

console.log(`\nZapsáno do ${args.project}. Přeneseno ${moved.size} souborů.`);
for (const warning of warnings) console.warn(`⚠ ${warning}`);
console.log("Web se obnoví nejpozději za hodinu (cache), nebo hned po novém nasazení.");

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((line) => /^[A-Z_][A-Z0-9_]*=/.test(line))
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
  );
}
