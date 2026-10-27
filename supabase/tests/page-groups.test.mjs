import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

/**
 * Page groups of the cookie-less counters (migration
 * 20261027000200_page_groups_entries): the entry pages moved to /entries and
 * must not be counted as '/other'; the old /topics address keeps its group;
 * unknown or typed-in segments still fall into '/other'.
 *
 * Run: npm run test:db
 */

const here = dirname(fileURLToPath(import.meta.url));
const migrations = join(here, "..", "migrations");
const db = new PGlite();

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
});

const group = async (path) =>
  (await db.query("select conversion_path_group($1) as g", [path])).rows[0].g;

test("page groups: entry pages and the newer pages have their own group", async () => {
  for (const [path, expected] of [
    ["/entries", "/entries"],
    ["/entries/migrant-smuggling", "/entries"],
    ["/topics/old-link", "/topics"],
    ["/careers", "/careers"],
    ["/skills/atlas-web", "/skills"],
    ["/privacy", "/privacy"],
    ["/", "/"],
    ["/?utm=x", "/"],
    ["/country/czechia", "/country"],
  ]) {
    assert.equal(await group(path), expected, path);
  }
});

test("page groups: anything else is '/other', so a typed-in path never makes a group", async () => {
  for (const path of ["/admin", "/wp-login.php", "/ENTRIES-x", "/a/b", "no-slash"]) {
    assert.equal(await group(path), "/other", path);
  }
});
