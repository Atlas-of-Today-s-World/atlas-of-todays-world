import { describe, expect, it } from "vitest";
import { activeItemId } from "./active";
import { flagAllows, NAV_DEFAULT_ROWS, navigationFrom, type NavRow } from "./model";

const ON = { newsMenu: true, newsletter: true };
const OFF = { newsMenu: false, newsletter: false };

const row = (overrides: Partial<NavRow> & Pick<NavRow, "id" | "label" | "href">): NavRow => ({
  menu: "main",
  is_primary: false,
  compact_hidden: false,
  requires_flag: null,
  ...overrides,
});

describe("built-in menus (fallback)", () => {
  it("are today's items with today's labels, styles and the News switch", () => {
    const nav = navigationFrom(NAV_DEFAULT_ROWS, ON);
    expect(
      nav.main.map((item) => [item.label, item.href, item.primary, item.compactHidden]),
    ).toEqual([
      ["Topics", "/topics", false, false],
      ["Countries", "/countries", false, true],
      ["News", "/news", false, true],
      ["About", "/about", false, false],
      ["Atlas Patrons", "/membership", true, false],
    ]);
    expect(nav.legal.map((item) => [item.label, item.href])).toEqual([
      ["Privacy", "/privacy"],
      ["Terms", "/terms"],
      ["Accessibility", "/accessibility"],
    ]);
    expect([...nav.main, ...nav.legal].every((item) => !item.external)).toBe(true);
    // Unique ids: they are the React keys.
    const ids = NAV_DEFAULT_ROWS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("leave News out while news_menu is off, as the header did before", () => {
    const labels = navigationFrom(NAV_DEFAULT_ROWS, OFF).main.map((item) => item.label);
    expect(labels).toEqual(["Topics", "Countries", "About", "Atlas Patrons"]);
  });
});

describe("navigationFrom", () => {
  it("splits the rows into the two menus, keeping their order", () => {
    const nav = navigationFrom(
      [
        row({ id: "a", label: "A", href: "/about" }),
        row({ id: "p", label: "P", href: "/privacy", menu: "legal" }),
        row({ id: "b", label: "B", href: "/news" }),
      ],
      ON,
    );
    expect(nav.main.map((item) => item.id)).toEqual(["a", "b"]);
    expect(nav.legal.map((item) => item.id)).toEqual(["p"]);
  });

  it("follows each item's switch", () => {
    const rows = [
      row({ id: "news", label: "News", href: "/news", requires_flag: "news_menu" }),
      row({ id: "nl", label: "Newsletter", href: "/newsletter", requires_flag: "newsletter" }),
      row({ id: "x", label: "X", href: "/about", requires_flag: "no_such_switch" }),
    ];
    const ids = (switches: typeof ON) => navigationFrom(rows, switches).main.map((i) => i.id);
    expect(ids(ON)).toEqual(["news", "nl"]);
    expect(ids({ newsMenu: true, newsletter: false })).toEqual(["news"]);
    expect(ids({ newsMenu: false, newsletter: true })).toEqual(["nl"]);
    expect(ids(OFF)).toEqual([]);
    expect(flagAllows(null, OFF)).toBe(true);
  });

  it("marks https:// links external and drops unsafe addresses", () => {
    const nav = navigationFrom(
      [
        row({ id: "shop", label: "Shop", href: "https://shop.example.org/atlas" }),
        row({ id: "evil", label: "Evil", href: "//evil.example" }),
        row({ id: "js", label: "JS", href: "javascript:alert(1)" }),
        row({ id: "http", label: "HTTP", href: "http://example.org/" }),
      ],
      ON,
    );
    expect(nav.main).toEqual([
      {
        id: "shop",
        label: "Shop",
        href: "https://shop.example.org/atlas",
        external: true,
        primary: false,
        compactHidden: false,
      },
    ]);
  });

  it("keeps the pill and the full-menu-only placement to the main menu", () => {
    const nav = navigationFrom(
      [
        row({
          id: "l",
          label: "L",
          href: "/terms",
          menu: "legal",
          is_primary: true,
          compact_hidden: true,
        }),
      ],
      ON,
    );
    expect(nav.legal[0]).toMatchObject({ primary: false, compactHidden: false });
  });
});

describe("activeItemId", () => {
  const items = navigationFrom(
    [
      row({ id: "home", label: "Home", href: "/" }),
      row({ id: "news", label: "News", href: "/news" }),
      row({ id: "view", label: "HDI", href: "/view/hdi#hun" }),
      row({ id: "view-all", label: "Views", href: "/view" }),
      row({ id: "support", label: "Support", href: "/membership" }),
      row({ id: "patrons", label: "Patrons", href: "/membership", is_primary: true }),
      row({ id: "search", label: "Search", href: "/search?q=water" }),
      row({ id: "ext", label: "Ext", href: "https://example.org/news" }),
    ],
    ON,
  ).main;

  it("matches the page and the pages under it, not lookalike prefixes", () => {
    expect(activeItemId(items, "/news")).toBe("news");
    expect(activeItemId(items, "/news/some-story")).toBe("news");
    expect(activeItemId(items, "/newsletter")).toBeNull();
  });

  it("matches the home page only on itself", () => {
    expect(activeItemId(items, "/")).toBe("home");
    expect(activeItemId(items, "/about")).toBeNull();
  });

  it("ignores the query and anchor of an item and prefers the most specific path", () => {
    expect(activeItemId(items, "/search")).toBe("search");
    expect(activeItemId(items, "/view/hdi")).toBe("view");
    expect(activeItemId(items, "/view/gdp")).toBe("view-all");
  });

  it("marks only the first of two items with the same address", () => {
    expect(activeItemId(items, "/membership/checkout")).toBe("support");
  });

  it("strips the internal /en prefix and never matches an external link", () => {
    expect(activeItemId(items, "/en/news/x")).toBe("news");
    expect(
      activeItemId(
        items.filter((item) => item.external),
        "/news",
      ),
    ).toBeNull();
  });
});
