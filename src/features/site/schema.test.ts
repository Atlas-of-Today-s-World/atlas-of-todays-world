import { describe, expect, it } from "vitest";
import { SettingsInput, SocialInput } from "./schema";

/** The form as the admin posts it (seeded values). */
const form = {
  name: " Atlas of Today's World ",
  alternate_names: "Atlas of Todays World\r\n\r\n ATW \n",
  legal_name: "Atlas of Today's World, z. s.",
  company_id: "05363454",
  founding_date: "2016-09-07",
  street_address: "náměstí Jana Palacha 1/2",
  postal_code: "110 00",
  address_locality: "Praha 1",
  address_country: "cz",
  description: "A non-profit encyclopedia of the present.",
  wikidata_id: "q106194019",
  contact_email: " Info@AtlasOfTodaysWorld.org ",
  seo_title: "Atlas of Today's World — interactive atlas of every country",
  title_suffix: "— Atlas of Today's World",
  seo_description: "Explore every country.",
  og_image_url: "/og-image.png",
  copyright: "© Atlas of Today’s World",
};

const issue = (input: Record<string, unknown>) =>
  SettingsInput.safeParse({ ...form, ...input }).error?.issues[0]?.path[0];

describe("site settings form", () => {
  it("accepts the seeded values and normalises them as the DB stores them", () => {
    expect(SettingsInput.parse(form)).toMatchObject({
      name: "Atlas of Today's World",
      alternate_names: ["Atlas of Todays World", "ATW"],
      address_country: "CZ",
      wikidata_id: "Q106194019",
      contact_email: "info@atlasoftodaysworld.org",
    });
  });

  it("empty optional fields: no Wikidata item, no title suffix, no alternate names", () => {
    expect(
      SettingsInput.parse({ ...form, wikidata_id: "", title_suffix: "", alternate_names: "" }),
    ).toMatchObject({ wikidata_id: null, title_suffix: "", alternate_names: [] });
  });

  it("refuses what the DB CHECKs refuse", () => {
    expect(issue({ company_id: "1234567" })).toBe("company_id");
    expect(issue({ company_id: "1234567a" })).toBe("company_id");
    expect(issue({ address_country: "CZE" })).toBe("address_country");
    expect(issue({ wikidata_id: "106194019" })).toBe("wikidata_id");
    expect(issue({ contact_email: "nobody" })).toBe("contact_email");
    expect(issue({ founding_date: "2016-02-30" })).toBe("founding_date");
    expect(issue({ founding_date: "7. 9. 2016" })).toBe("founding_date");
    expect(issue({ name: "  " })).toBe("name");
    expect(issue({ seo_title: "x".repeat(121) })).toBe("seo_title");
    expect(issue({ seo_description: "x".repeat(301) })).toBe("seo_description");
    expect(issue({ description: "x".repeat(501) })).toBe("description");
    expect(issue({ title_suffix: "x".repeat(81) })).toBe("title_suffix");
    expect(issue({ copyright: "" })).toBe("copyright");
    expect(
      issue({ alternate_names: Array.from({ length: 11 }, (_, i) => `Name ${i}`).join("\n") }),
    ).toBe("alternate_names");
    expect(issue({ alternate_names: "x".repeat(121) })).toBe("alternate_names");
  });

  it("the preview image: https:// or a path on this site, nothing that leaves it", () => {
    expect(issue({ og_image_url: "https://cdn.example.org/og.png" })).toBeUndefined();
    expect(issue({ og_image_url: "/brand/og.png" })).toBeUndefined();
    for (const url of [
      "http://example.org/og.png",
      "//evil.example/og.png",
      "/\\evil.example/og.png",
      "javascript:alert(1)",
      "og.png",
      "/og image.png",
      `https://example.org/${"x".repeat(1000)}`,
    ]) {
      expect(issue({ og_image_url: url }), url).toBe("og_image_url");
    }
  });
});

describe("social link form", () => {
  const link = { label: "Instagram", url: "https://www.instagram.com/atlas/", icon: "IG" };

  it("accepts a link; the checkbox decides visibility", () => {
    expect(SocialInput.parse({ ...link, visible: "on" })).toEqual({ ...link, visible: true });
    expect(SocialInput.parse(link).visible).toBe(false);
  });

  it("refuses what the DB CHECKs refuse", () => {
    const bad = (input: Record<string, unknown>) =>
      SocialInput.safeParse({ ...link, ...input }).success;
    expect(bad({ url: "http://instagram.com/atlas" })).toBe(false);
    expect(bad({ url: "javascript:alert(1)" })).toBe(false);
    expect(bad({ icon: "ABCD" })).toBe(false);
    expect(bad({ icon: "a b" })).toBe(false);
    expect(bad({ icon: "" })).toBe(false);
    expect(bad({ label: " " })).toBe(false);
    expect(bad({ label: "x".repeat(61) })).toBe(false);
  });
});
