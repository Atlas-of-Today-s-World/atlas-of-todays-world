import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** What the anonymous client answers (`{ data, error }`, or a throw) and the switches. */
const answer = vi.hoisted(() => ({ items: vi.fn(), flags: vi.fn() }));

// The cache is Next's (and React's); here every call reads the "database".
vi.mock("next/cache", () => ({ unstable_cache: (fn: () => unknown) => fn }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  cache: (fn: () => unknown) => fn,
}));
vi.mock("@/features/flags/queries", () => ({ getFlags: () => answer.flags() }));
vi.mock("@/lib/supabase/public", () => ({
  createPublicClient: () => {
    const query = {
      select: () => query,
      eq: () => query,
      order: () => query,
      then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
        Promise.resolve()
          .then(() => answer.items())
          .then(resolve, reject),
    };
    return { from: () => query };
  },
}));

const { getNavigation } = await import("./queries");

const FLAGS = { maintenance: false, newsletter: true, emailAuth: false, newsMenu: false };
const ROWS = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    menu: "main",
    label: "Explore",
    href: "/topics",
    is_primary: false,
    compact_hidden: false,
    requires_flag: null,
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    menu: "main",
    label: "News",
    href: "/news",
    is_primary: false,
    compact_hidden: true,
    requires_flag: "news_menu",
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    menu: "legal",
    label: "Imprint",
    href: "https://example.org/imprint",
    is_primary: false,
    compact_hidden: false,
    requires_flag: null,
  },
];

const labels = (nav: Awaited<ReturnType<typeof getNavigation>>) => ({
  main: nav.main.map((item) => item.label),
  legal: nav.legal.map((item) => item.label),
});

describe("getNavigation (public read)", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    answer.flags.mockResolvedValue(FLAGS);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    answer.items.mockReset();
    answer.flags.mockReset();
  });

  it("shows the database items, without those whose switch is off", async () => {
    answer.items.mockResolvedValue({ data: ROWS, error: null });
    expect(labels(await getNavigation())).toEqual({ main: ["Explore"], legal: ["Imprint"] });

    answer.flags.mockResolvedValue({ ...FLAGS, newsMenu: true });
    const nav = await getNavigation();
    expect(labels(nav)).toEqual({ main: ["Explore", "News"], legal: ["Imprint"] });
    expect(nav.legal[0]).toMatchObject({ external: true, href: "https://example.org/imprint" });
  });

  it("falls back to the built-in menus when the read fails", async () => {
    answer.items.mockResolvedValue({ data: null, error: { message: "relation does not exist" } });
    expect(labels(await getNavigation())).toEqual({
      main: ["Topics", "Countries", "About", "Support the Atlas", "Atlas Patrons"],
      legal: ["Privacy", "Terms", "Accessibility"],
    });
    expect(console.error).toHaveBeenCalledWith("[navigation]", "relation does not exist");
  });

  it("falls back when the client throws (no env, network), still following the switches", async () => {
    answer.items.mockRejectedValue(new Error("fetch failed"));
    answer.flags.mockResolvedValue({ ...FLAGS, newsMenu: true });
    expect(labels(await getNavigation()).main).toContain("News");
  });

  it("an empty table is the team's choice, not a failure", async () => {
    answer.items.mockResolvedValue({ data: [], error: null });
    expect(labels(await getNavigation())).toEqual({ main: [], legal: [] });
    expect(console.error).not.toHaveBeenCalled();
  });
});
