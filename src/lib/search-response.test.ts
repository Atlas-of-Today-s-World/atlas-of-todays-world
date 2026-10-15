import { beforeEach, describe, expect, it, vi } from "vitest";

const allowRequest = vi.hoisted(() => vi.fn());
vi.mock("@/lib/security/rate-limit", () => ({ allowRequest }));

const { searchResponse } = await import("./search-response");
const { isSearchable, normalizeSearchQuery } = await import("./search-query");

const LIMITS = { limit: 60, windowSeconds: 60 };
const request = (q: string) =>
  new Request(`https://atlas.test/api/search?q=${encodeURIComponent(q)}`);

describe("normalizeSearchQuery", () => {
  it("gives equal queries one spelling", () => {
    expect(normalizeSearchQuery("  Water\t  CRISIS \n")).toBe("water crisis");
    expect(normalizeSearchQuery("water crisis")).toBe("water crisis");
    expect(normalizeSearchQuery("   ")).toBe("");
  });

  it("caps the length without leaving a trailing space", () => {
    expect(normalizeSearchQuery("a".repeat(199) + " b")).toBe("a".repeat(199));
    expect(normalizeSearchQuery("a".repeat(500))).toHaveLength(200);
  });
});

describe("isSearchable", () => {
  it("needs a word of at least three letters or digits, as search_query() does", () => {
    expect(isSearchable("")).toBe(false);
    expect(isSearchable("a")).toBe(false);
    expect(isSearchable("ab")).toBe(false);
    expect(isSearchable("eu un of")).toBe(false);
    expect(isSearchable("a-b c'd")).toBe(false);
    expect(isSearchable("abc")).toBe(true);
    expect(isSearchable("of water")).toBe(true);
    expect(isSearchable("Čad")).toBe(true);
    expect(isSearchable("g20")).toBe(true);
  });
});

describe("searchResponse", () => {
  beforeEach(() => {
    allowRequest.mockReset().mockResolvedValue(true);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("answers with the normalised query, cacheable on the CDN only", async () => {
    const find = vi.fn().mockResolvedValue([{ id: "a" }]);
    const response = await searchResponse(request(" Sahel  Drought "), "search", LIMITS, find);

    expect(find).toHaveBeenCalledWith("sahel drought", expect.any(URLSearchParams));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ query: "sahel drought", results: [{ id: "a" }] });
    expect(response.headers.get("cache-control")).toBe("public, max-age=0");
    expect(response.headers.get("cdn-cache-control")).toBe(
      "public, s-maxage=300, stale-while-revalidate=3600",
    );
  });

  it("a rate-limited request is refused and never cached", async () => {
    allowRequest.mockResolvedValue(false);
    const find = vi.fn();
    const response = await searchResponse(request("sahel"), "search", LIMITS, find);

    expect(find).not.toHaveBeenCalled();
    expect(response.status).toBe(429);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("cdn-cache-control")).toBeNull();
  });

  it("a failed search answers 500 and is never cached", async () => {
    const find = vi.fn().mockRejectedValue(new Error("db down"));
    const response = await searchResponse(request("sahel"), "search", LIMITS, find);

    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("cdn-cache-control")).toBeNull();
  });
});
