import { beforeEach, describe, expect, it, vi } from "vitest";

const search = vi.hoisted(() => vi.fn());
const allowRequest = vi.hoisted(() => vi.fn());
const SEARCH_LIMIT = vi.hoisted(() => ({ limit: 60, windowSeconds: 60 }));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/search", () => ({ search, SEARCH_LIMIT }));
vi.mock("@/lib/security/rate-limit", () => ({ allowRequest }));

const { default: SearchPage } = await import("@/app/[locale]/(pages)/search/page");
const { firstParam } = await import("@/lib/query-params");

const render = (q?: string | string[]) =>
  SearchPage({
    params: Promise.resolve({ locale: "en" }),
    searchParams: Promise.resolve(q === undefined ? {} : { q }),
  });

describe("/search page", () => {
  beforeEach(() => {
    search.mockReset().mockResolvedValue([]);
    allowRequest.mockReset().mockResolvedValue(true);
  });

  it("counts searches against the same limit as /api/search", async () => {
    await render("sahel");
    expect(allowRequest).toHaveBeenCalledWith("search", expect.any(Headers), SEARCH_LIMIT);
    expect(search).toHaveBeenCalledWith("sahel", 40);
  });

  it("over the limit it doesn't query the database", async () => {
    allowRequest.mockResolvedValue(false);
    await render("sahel");
    expect(search).not.toHaveBeenCalled();
  });

  it("an empty query neither searches nor counts", async () => {
    await render();
    expect(allowRequest).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
  });

  it("a repeated ?q= doesn't fail — the first value counts", async () => {
    await expect(render(["a", "b"])).resolves.toBeTruthy();
    expect(search).toHaveBeenCalledWith("a", 40);
  });
});

describe("firstParam", () => {
  it("takes the first of repeated values; a missing one is empty", () => {
    expect(firstParam("sahel")).toBe("sahel");
    expect(firstParam(["x", "y"])).toBe("x");
    expect(firstParam([])).toBe("");
    expect(firstParam(null)).toBe("");
    expect(firstParam(undefined)).toBe("");
  });
});
