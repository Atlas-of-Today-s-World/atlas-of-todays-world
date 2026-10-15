import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Supabase records each migration by the number before the first underscore.
 * Two files with the same number pass locally but stop the production deploy
 * (duplicate key in schema_migrations), so CI refuses them here.
 */
describe("supabase migrations", () => {
  const files = readdirSync(join(process.cwd(), "supabase", "migrations")).filter((file) =>
    file.endsWith(".sql"),
  );

  it("each file has a numeric version and a name", () => {
    for (const file of files) expect(file).toMatch(/^\d{14}_[a-z0-9_]+\.sql$/);
  });

  it("no two files share a version", () => {
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const file of files) {
      const version = file.split("_")[0];
      const other = seen.get(version);
      if (other) clashes.push(`${other} ↔ ${file}`);
      else seen.set(version, file);
    }
    expect(clashes).toEqual([]);
  });
});
