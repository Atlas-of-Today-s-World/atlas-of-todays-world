import { describe, expect, it } from "vitest";
import { entryChangedTags, entryPageTags, tags } from "./tags";

describe("cache tags", () => {
  it("names one article and one country by their key", () => {
    expect(tags.entry("water-crisis")).toBe("entry:water-crisis");
    expect(tags.country("CZE")).toBe("country:CZE");
    expect(tags.indicator("hdi")).toBe("indicator:hdi");
    expect(tags.portrait("issue", "sahel")).toBe("portrait:issue:sahel");
  });

  it("an article page is cached under its own tag, never the list tag", () => {
    const page = entryPageTags("water-crisis");
    expect(page).toEqual([tags.entry("water-crisis"), tags.entryPages]);
    expect(page).not.toContain(tags.entries);
    // Another article's page doesn't share the slug tag.
    expect(entryPageTags("drought")).not.toContain(tags.entry("water-crisis"));
  });

  it("a changed article refreshes the lists and its own page", () => {
    expect(entryChangedTags("water-crisis")).toEqual([tags.entries, tags.entry("water-crisis")]);
  });

  it("without a slug only the lists are refreshed", () => {
    expect(entryChangedTags(null)).toEqual([tags.entries]);
    expect(entryChangedTags(undefined)).toEqual([tags.entries]);
    expect(entryChangedTags("")).toEqual([tags.entries]);
  });

  it("the tags of a changed article reach its cached page", () => {
    const page = new Set(entryPageTags("water-crisis"));
    expect(entryChangedTags("water-crisis").some((tag) => page.has(tag))).toBe(true);
  });
});
