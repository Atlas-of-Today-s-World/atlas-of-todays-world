#!/usr/bin/env node
/**
 * One-off: preview images for resources ("Learn more" links of topics and
 * portraits) that have none — most of the imported ones. Each link's page is
 * read under the SSRF rules of src/lib/previews/preview-image.ts (og:image /
 * twitter:image, YouTube thumbnails without a request); only the image's
 * https address is stored, the image itself is never downloaded.
 *
 *   node scripts/backfill-resource-previews.mjs [--project dev|prod] [--apply]
 *        [--rows rows.json] [--sql updates.sql] [--limit 100] [--env .env.local]
 *
 * Which rows: `--rows` (a JSON list of { id, url }, e.g. exported with psql),
 * otherwise read through the service key (NEXT_PUBLIC_SUPABASE_URL +
 * SUPABASE_SERVICE_ROLE_KEY from the environment or --env), whose project
 * must match --project.
 *
 * Without --apply it is a DRY RUN: it lists what it would set and writes
 * nothing. --apply writes through the service key; --sql writes UPDATE
 * statements to a file instead (production, where only the database
 * password is at hand — .github/workflows/backfill-resource-previews.yml).
 * Every update keeps an image set in the meantime (`where image_url is null`),
 * so a repeated run only fills what is still empty. Secrets are never printed.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { findPreviewImage } from "../src/lib/previews/preview-image.ts";

const PROJECTS = { dev: "bognwszwhxxyjafqzfuh", prod: "ewbzkxialhtwuqlenjof" };
const CONCURRENCY = 6;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const { values: args } = parseArgs({
  options: {
    project: { type: "string" },
    apply: { type: "boolean", default: false },
    rows: { type: "string" },
    sql: { type: "string" },
    limit: { type: "string" },
    env: { type: "string", default: ".env.local" },
  },
});
if (args.apply && args.sql) {
  console.error("Choose one: --apply (write through the service key) or --sql (write a file).");
  process.exit(2);
}

/** The service-key client of the project named by --project (refuses a mismatch). */
let client;
async function db() {
  if (client) return client;
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
  client = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  return client;
}

/** Resources without an image: from --rows, else through the service key. */
async function loadRows() {
  if (args.rows) return JSON.parse(readFileSync(args.rows, "utf8"));
  const supabase = await db();
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("resources")
      .select("id, url")
      .is("image_url", null)
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(`resources: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

// A refused --apply should fail before minutes of fetching, not after.
if (args.apply) await db();

const all = (await loadRows()).filter(
  (row) => typeof row?.id === "string" && UUID.test(row.id) && typeof row.url === "string",
);
const rows = args.limit ? all.slice(0, Number(args.limit)) : all;
console.log(
  `${rows.length} resources without an image${rows.length < all.length ? ` (of ${all.length})` : ""}.`,
);

// The same link often sits in several topics: each page is read once.
const urls = [...new Set(rows.map((row) => row.url))];
const images = new Map();
let next = 0;
async function worker() {
  while (next < urls.length) {
    const url = urls[next++];
    const image = await findPreviewImage(url);
    if (image) images.set(url, image);
    console.log(`${image ? "✓" : "–"} ${url}${image ? `\n    → ${image}` : ""}`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

const updates = rows.flatMap((row) =>
  images.has(row.url) ? [{ id: row.id, image_url: images.get(row.url) }] : [],
);
console.log(`\nPreview found for ${images.size} of ${urls.length} links → ${updates.length} rows.`);

if (args.sql) {
  const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
  const statements = updates.map(
    ({ id, image_url }) =>
      `update public.resources set image_url = ${quote(image_url)} where id = ${quote(id)} and image_url is null;`,
  );
  writeFileSync(args.sql, `begin;\n${statements.join("\n")}\ncommit;\n`);
  console.log(`SQL for ${updates.length} rows → ${args.sql}`);
} else if (!args.apply) {
  console.log("Dry run — nothing written. Write: --apply --project dev, or --sql <file>.");
} else {
  const supabase = await db();
  let written = 0;
  for (const { id, image_url } of updates) {
    const { data, error } = await supabase
      .from("resources")
      .update({ image_url })
      .eq("id", id)
      .is("image_url", null)
      .select("id");
    if (error) throw new Error(`resource ${id}: ${error.message}`);
    written += data.length;
  }
  console.log(`Written to ${args.project}: ${written} rows.`);
}

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((line) => /^[A-Z_][A-Z0-9_]*=/.test(line))
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
  );
}
