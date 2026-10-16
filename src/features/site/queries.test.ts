import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** What the anonymous client answers: `{ data, error }`, or a throw (no env, network). */
const answer = vi.hoisted(() => ({
  settings: vi.fn(),
  socials: vi.fn(),
}));

// The cache is Next's; here every call reads the "database".
vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => unknown) => fn,
}));

vi.mock("@/lib/supabase/public", () => ({
  createPublicClient: () => ({
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        order: () => query,
        maybeSingle: () => answer.settings(),
        then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
          Promise.resolve()
            .then(() => (table === "site_social_links" ? answer.socials() : null))
            .then(resolve, reject),
      };
      return query;
    },
  }),
}));

const { getSiteSettings, getSocialLinks } = await import("./queries");
const { SITE_DEFAULTS, SOCIAL_DEFAULTS } = await import("./model");

const ROW = {
  name: "Atlas Org",
  alternate_names: ["AO"],
  legal_name: "Atlas Org, z. s.",
  company_id: "12345678",
  founding_date: "2020-01-02",
  street_address: "Main 1",
  postal_code: "100 00",
  address_locality: "Praha",
  address_country: "CZ",
  description: "An atlas.",
  wikidata_id: "Q1",
  contact_email: "hello@atlas.example",
  seo_title: "Atlas Org — maps",
  title_suffix: "| Atlas Org",
  seo_description: "Explore.",
  og_image_url: "https://cdn.example.org/og.png",
  copyright: "© Atlas Org",
  portrait_sections: ["faq", "timeline", "topics", "visuals", "resources"],
};

describe("site settings (public read)", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    answer.settings.mockReset();
    answer.socials.mockReset();
  });

  it("maps the database row", async () => {
    answer.settings.mockResolvedValue({ data: ROW, error: null });
    expect(await getSiteSettings()).toEqual({
      name: "Atlas Org",
      alternateNames: ["AO"],
      legalName: "Atlas Org, z. s.",
      companyId: "12345678",
      foundingDate: "2020-01-02",
      address: {
        streetAddress: "Main 1",
        postalCode: "100 00",
        addressLocality: "Praha",
        addressCountry: "CZ",
      },
      description: "An atlas.",
      wikidataId: "Q1",
      email: "hello@atlas.example",
      seoTitle: "Atlas Org — maps",
      titleSuffix: "| Atlas Org",
      seoDescription: "Explore.",
      ogImage: "https://cdn.example.org/og.png",
      copyright: "© Atlas Org",
      // The editors' order is kept as stored.
      sectionOrder: ["faq", "timeline", "topics", "visuals", "resources"],
    });
  });

  it("falls back to the built-in values when the row is missing, the read fails or throws", async () => {
    answer.settings.mockResolvedValue({ data: null, error: null });
    expect(await getSiteSettings()).toEqual(SITE_DEFAULTS);

    answer.settings.mockResolvedValue({
      data: null,
      error: { message: "relation does not exist" },
    });
    expect(await getSiteSettings()).toEqual(SITE_DEFAULTS);

    answer.settings.mockRejectedValue(new Error("Supabase is not configured"));
    expect(await getSiteSettings()).toEqual(SITE_DEFAULTS);
    expect(console.error).toHaveBeenCalled();
  });

  it("the fallback is exactly what the site showed before the admin took it over", () => {
    expect(SITE_DEFAULTS).toMatchObject({
      name: "Atlas of Today's World",
      email: "info@atlasoftodaysworld.org",
      seoTitle: "Atlas of Today's World — interactive atlas of every country",
      titleSuffix: "— Atlas of Today's World",
      ogImage: "/og-image.png",
      copyright: "© Atlas of Today’s World",
      wikidataId: "Q106194019",
    });
    expect(SOCIAL_DEFAULTS.map((social) => social.icon)).toEqual(["IG", "in", "f", "bs"]);
  });

  it("an unsafe preview image never reaches the page", async () => {
    answer.settings.mockResolvedValue({
      data: { ...ROW, og_image_url: "//evil.example/x.png" },
      error: null,
    });
    expect((await getSiteSettings()).ogImage).toBe(SITE_DEFAULTS.ogImage);
  });
});

describe("social links (public read)", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    answer.socials.mockReset();
  });

  it("maps the visible links in order and leaves out unsafe addresses", async () => {
    answer.socials.mockResolvedValue({
      data: [
        { label: "Mastodon", url: "https://mastodon.social/@atlas", icon: "M" },
        { label: "Bad", url: "javascript:alert(1)", icon: "X" },
      ],
      error: null,
    });
    expect(await getSocialLinks()).toEqual([
      { label: "Mastodon", href: "https://mastodon.social/@atlas", icon: "M" },
    ]);
  });

  it("an empty table means no badges; a failed read falls back to the built-in links", async () => {
    answer.socials.mockResolvedValue({ data: [], error: null });
    expect(await getSocialLinks()).toEqual([]);

    answer.socials.mockResolvedValue({ data: null, error: { message: "timeout" } });
    expect(await getSocialLinks()).toEqual(SOCIAL_DEFAULTS);

    answer.socials.mockRejectedValue(new Error("offline"));
    expect(await getSocialLinks()).toEqual(SOCIAL_DEFAULTS);
  });
});
