#!/usr/bin/env node
/**
 * Applies the repository's migrations missing on atlas-dev through the
 * Supabase Management API — needs only SUPABASE_ACCESS_TOKEN, no database
 * password (the CLI's `db push` needs one).
 *
 *   SUPABASE_ACCESS_TOKEN=… node scripts/supabase-migrate-dev.mjs [--ref <dev ref>] [--dry-run]
 *
 * Each missing file runs in one request (a transaction) and is then recorded
 * in supabase_migrations.schema_migrations exactly as `db push` records it.
 * Refuses the production project.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

const PROD_REF = "ewbzkxialhtwuqlenjof";
const { values: args } = parseArgs({
  options: {
    ref: {
      type: "string",
      default: process.env.SUPABASE_DEV_PROJECT_REF || "bognwszwhxxyjafqzfuh",
    },
    "dry-run": { type: "boolean", default: false },
  },
});
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error("Missing SUPABASE_ACCESS_TOKEN.");
  process.exit(2);
}
if (args.ref === PROD_REF || args.ref === process.env.SUPABASE_PROJECT_REF) {
  console.error("Refused: this script never touches production.");
  process.exit(2);
}

async function query(sql) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${args.ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`${response.status}: ${body.slice(0, 600)}`);
  return body ? JSON.parse(body) : [];
}

const quote = (value) => `'${value.replace(/'/g, "''")}'`;
const dir = "supabase/migrations";
const applied = new Set(
  (await query("select version from supabase_migrations.schema_migrations")).map(
    (row) => row.version,
  ),
);
const missing = readdirSync(dir)
  .filter((file) => /^\d+_.+\.sql$/.test(file))
  .sort()
  .filter((file) => !applied.has(file.split("_")[0]));

console.log(`${applied.size} applied, ${missing.length} missing on ${args.ref}.`);
for (const file of missing) {
  const [version, ...rest] = file.replace(/\.sql$/, "").split("_");
  console.log(`→ ${file}`);
  if (args["dry-run"]) continue;
  const sql = readFileSync(join(dir, file), "utf8");
  await query(
    `begin;\n${sql}\n;\ninsert into supabase_migrations.schema_migrations (version, name, statements)` +
      ` values (${quote(version)}, ${quote(rest.join("_"))}, array[${quote(sql)}]);\ncommit;`,
  );
}
console.log(args["dry-run"] ? "Dry run, nothing applied." : "Done.");
