import { beforeEach, describe, expect, it, vi } from "vitest";
import { SITE_DEFAULTS, type SiteSettings } from "@/features/site/model";
import { SITE_URL } from "@/lib/site";
import en from "@/messages/en.json";

const getSiteSettings = vi.hoisted(() => vi.fn());
vi.mock("@/features/site/queries", () => ({ getSiteSettings }));
// The UI texts without the team's overrides (no database in unit tests).
vi.mock("@/features/i18n/request", () => ({
  localeFrom: async () => "en",
  getMessagesFor: async () => en,
}));

const {
  clampText,
  fullTitle,
  pageMetadata,
  pageTitle,
  privateMetadata,
  staticPageMetadata,
  TITLE_SUFFIX,
} = await import("./metadata");

const SITE = SITE_URL.replace(/\/$/, "");

describe("clampText", () => {
  it("keeps short text, collapses whitespace", () => {
    expect(clampText("  A  short\n text ", 160)).toBe("A short text");
  });

  it("cuts at a word boundary with an ellipsis, within the limit", () => {
    const text =
      "The workshop of the global economy and the arena where the century's rivalry plays out.";
    const cut = clampText(text, 40);
    expect(cut.length).toBeLessThanOrEqual(40);
    expect(cut.endsWith("…")).toBe(true);
    expect(text.startsWith(cut.slice(0, -1))).toBe(true);
    expect(cut).not.toMatch(/\s…$/);
  });
});

describe("pageTitle", () => {
  it("adds the qualifier only when the whole title fits 60 characters", () => {
    expect(pageTitle("Food", "Hunger")).toBe("Food — Hunger");
    expect(
      pageTitle("Food Insecurity", "Where hunger is a political outcome, not a harvest failure"),
    ).toBe("Food Insecurity");
  });

  it("drops the brand when even the bare title is too long", () => {
    const long = "A very long encyclopedia entry title about smuggling routes";
    expect(pageTitle(long)).toEqual({ absolute: long });
    expect(fullTitle(pageTitle(long))).toBe(long);
    expect(fullTitle("East Asia")).toBe(`East Asia${TITLE_SUFFIX}`);
    expect(fullTitle(`East Asia${TITLE_SUFFIX}`).length).toBeLessThanOrEqual(60);
  });
});

describe("pageMetadata", () => {
  beforeEach(() => {
    getSiteSettings.mockReset().mockResolvedValue(SITE_DEFAULTS);
  });

  it("sets canonical, hreflang, og:url and og:locale", async () => {
    const meta = await pageMetadata({
      locale: "en",
      path: "/region/east-asia",
      title: "East Asia",
      description: "x".repeat(300),
    });
    expect(meta.alternates?.canonical).toBe("/region/east-asia");
    expect(meta.alternates?.languages).toMatchObject({
      en: "/region/east-asia",
      "x-default": "/region/east-asia",
    });
    expect(meta.openGraph).toMatchObject({
      url: `${SITE}/region/east-asia`,
      locale: "en_US",
      images: [{ url: "/og-image.png" }],
      siteName: "Atlas of Today's World",
      title: `East Asia${TITLE_SUFFIX}`,
    });
    expect(String(meta.description).length).toBeLessThanOrEqual(160);
    // Absent, not undefined: an undefined key would wipe the root layout's robots
    // (max-image-preview:large) and the segment's opengraph-image when Next merges.
    expect("robots" in meta).toBe(false);
    expect(Object.values(meta)).not.toContain(undefined);
    expect(Object.values(meta.openGraph ?? {})).not.toContain(undefined);
  });

  it("takes the brand and the default image from the site settings", async () => {
    const site: SiteSettings = {
      ...SITE_DEFAULTS,
      name: "Atlas Org",
      titleSuffix: "| Atlas Org",
      ogImage: "https://cdn.example.org/og.png",
    };
    getSiteSettings.mockResolvedValue(site);
    const meta = await pageMetadata({
      locale: "en",
      path: "/countries",
      title: "Countries",
      description: "All countries.",
    });
    expect(meta.openGraph).toMatchObject({
      siteName: "Atlas Org",
      title: "Countries | Atlas Org",
      images: [{ url: "https://cdn.example.org/og.png" }],
    });
    expect(fullTitle("Countries", { ...site, titleSuffix: "" })).toBe("Countries");
    expect(fullTitle(undefined, site)).toBe("Atlas Org");
  });

  it("keeps an editor's description whole and marks noindex pages", async () => {
    const description = `${"word ".repeat(33)}end`;
    const meta = await pageMetadata({
      locale: "en",
      path: "/search",
      title: "Search",
      description,
      authoredDescription: true,
      noindex: true,
    });
    expect(meta.description).toBe(description.trim());
    expect(meta.robots).toMatchObject({ index: false, follow: true });
  });
});

describe("privateMetadata", () => {
  it("keeps the page out of the index without following its links", () => {
    expect(privateMetadata("Sign in")).toEqual({
      title: "Sign in",
      robots: { index: false, follow: false },
    });
  });
});

describe("staticPageMetadata", () => {
  beforeEach(() => {
    getSiteSettings.mockReset().mockResolvedValue(SITE_DEFAULTS);
  });

  const params = Promise.resolve({ locale: "en" });

  it("is the page metadata from the section's metaTitle, else its title", async () => {
    const topics = await staticPageMetadata("topics", "/topics")({ params });
    expect(topics).toEqual(
      await pageMetadata({
        locale: "en",
        path: "/topics",
        title: en.topics.metaTitle,
        description: en.topics.description,
      }),
    );
    const news = await staticPageMetadata("newsIndex", "/news")({ params });
    expect(news.title).toBe(en.newsIndex.title);
  });

  it("passes noindex and ownImage on", async () => {
    const search = await staticPageMetadata("searchPage", "/search", { noindex: true })({ params });
    expect(search.robots).toMatchObject({ index: false, follow: true });
    const membership = await staticPageMetadata("patrons", "/membership", { ownImage: true })({
      params,
    });
    expect(membership.openGraph).not.toHaveProperty("images");
  });
});
