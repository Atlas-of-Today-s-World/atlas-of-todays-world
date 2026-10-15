import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import { ENTRY_CATEGORIES, NEWS_CATEGORIES, categoryLabel, entryCategory } from "./content-types";

describe("content categories", () => {
  it("are exactly the DB CHECK on entries.category, in display order", () => {
    const sql = readFileSync("supabase/migrations/20260929000003_content.sql", "utf8");
    const check = /category\s+text not null check \(category in \(([^)]*)\)\)/.exec(sql)?.[1];
    const dbCategories = [...(check ?? "").matchAll(/'([^']+)'/g)].map((match) => match[1]);
    expect(NEWS_CATEGORIES).toEqual(dbCategories);
    expect(NEWS_CATEGORIES).toEqual([
      "Living Conditions",
      "Political System",
      "Society",
      "International Relations",
      "Historical Roots",
    ]);
  });

  it("map onto the four portrait topic groups", () => {
    expect(ENTRY_CATEGORIES).toEqual([
      "Living Conditions",
      "Society",
      "Politics & International Relations",
      "Historical Roots",
    ]);
    expect(NEWS_CATEGORIES.map(entryCategory)).toEqual([
      "Living Conditions",
      "Politics & International Relations",
      "Society",
      "Politics & International Relations",
      "Historical Roots",
    ]);
    expect(entryCategory("Unknown")).toBe("Society");
    expect(entryCategory("toString")).toBe("Society");
  });

  it("have a label for every category and group", () => {
    for (const key of [...NEWS_CATEGORIES, ...ENTRY_CATEGORIES])
      expect(en.categories[key]).toBeTruthy();
  });
});

describe("categoryLabel", () => {
  it("reads the label from the UI texts; an unknown key shows as itself", () => {
    expect(categoryLabel("Political System", en)).toBe(en.categories["Political System"]);
    expect(categoryLabel("Unknown", en)).toBe("Unknown");
    expect(categoryLabel("toString", en)).toBe("toString");
  });
});
