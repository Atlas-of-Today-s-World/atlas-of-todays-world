import { describe, expect, it } from "vitest";
import { groupSearchHits, searchKindKey } from "./search-kind";

describe("search hit labels", () => {
  it("tells topics from news items, though both are the database's news kind", () => {
    expect(searchKindKey({ kind: "news", url: "/topics/migrant-smuggling" })).toBe("kindTopic");
    expect(searchKindKey({ kind: "news", url: "/news/elections-2026" })).toBe("kindNews");
  });

  it("labels places and leaves unknown kinds to the caller", () => {
    expect(searchKindKey({ kind: "country", url: "/country/chad" })).toBe("kindCountry");
    expect(searchKindKey({ kind: "issue", url: "/global-issue/sahel" })).toBe("kindIssue");
    expect(searchKindKey({ kind: "other", url: "/x" })).toBeNull();
  });
});

describe("groupSearchHits", () => {
  it("puts countries, regions and issues before articles, keeping the ranking inside each", () => {
    const hits = [
      { id: "news:a", kind: "news" },
      { id: "region:b", kind: "region" },
      { id: "country:cog", kind: "country" },
      { id: "news:c", kind: "news" },
      { id: "issue:d", kind: "issue" },
      { id: "country:cod", kind: "country" },
    ];
    expect(groupSearchHits(hits).map((hit) => hit.id)).toEqual([
      "country:cog",
      "country:cod",
      "region:b",
      "issue:d",
      "news:a",
      "news:c",
    ]);
  });
});
