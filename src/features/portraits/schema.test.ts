import { describe, expect, it } from "vitest";
import { CountryInput, FeaturedIndicators, RegionInput } from "./schema";

const region = (fields: Record<string, unknown> = {}) =>
  RegionInput.safeParse({
    slug: "east-asia",
    name: "East Asia",
    tagline: "",
    summary: "",
    intro: "",
    hero_url: "",
    hero_credit: "",
    fill: "#aabbcc",
    stroke: "#112233",
    center_lon: "115",
    center_lat: "36",
    zoom: "2.6",
    ...fields,
  });

describe("region header: where the globe turns", () => {
  it("takes the centre and zoom from the form as numbers", () => {
    const parsed = region();
    expect(
      parsed.success && [parsed.data.center_lon, parsed.data.center_lat, parsed.data.zoom],
    ).toEqual([115, 36, 2.6]);
  });

  it("refuses what the DB CHECKs refuse", () => {
    for (const fields of [
      { center_lon: "180.1" },
      { center_lon: "-181" },
      { center_lat: "90.5" },
      { zoom: "0.4" },
      { zoom: "9.1" },
      { zoom: "far" },
    ]) {
      expect(region(fields).success, JSON.stringify(fields)).toBe(false);
    }
    expect(region({ center_lon: "-180", center_lat: "90", zoom: "9" }).success).toBe(true);
  });
});

const country = (fields: Record<string, unknown> = {}) =>
  CountryInput.safeParse({
    iso3: "XKX",
    name: "Kosovo",
    name_formal: "Republic of Kosovo",
    population: "1794248",
    un_subregion: "Southern Europe",
    territory_note: "",
    blurb: "",
    tagline: "",
    profile_html: "",
    featured_indicators: [],
    ...fields,
  });

describe("country facts", () => {
  it("reads the facts; empty optional ones become undefined (stored as null)", () => {
    const parsed = country({ name_formal: " ", population: "", un_subregion: "" });
    expect(parsed.success && parsed.data).toMatchObject({ name: "Kosovo" });
    expect(parsed.data?.name_formal).toBeUndefined();
    expect(parsed.data?.population).toBeUndefined();
    expect(parsed.data?.un_subregion).toBeUndefined();
    expect(parsed.data?.territory_note).toBeUndefined();
    expect(country().data?.population).toBe(1794248);
  });

  it("needs a name and keeps the DB limits", () => {
    expect(country({ name: "  " }).error?.issues[0]?.path).toEqual(["name"]);
    expect(country({ name: "a".repeat(121) }).success).toBe(false);
    expect(country({ name_formal: "a".repeat(201) }).success).toBe(false);
    expect(country({ un_subregion: "a".repeat(61) }).success).toBe(false);
    expect(country({ territory_note: "a".repeat(1001) }).success).toBe(false);
    expect(country({ territory_note: "a".repeat(1000) }).success).toBe(true);
  });

  it("a population is a whole number from 0 to twenty billion", () => {
    for (const population of ["-1", "1.5", "20000000001", "many"]) {
      expect(country({ population }).success, population).toBe(false);
    }
    expect(country({ population: "0" }).success).toBe(true);
  });
});

describe("featured indicators", () => {
  it("keep the order the editor chose", () => {
    const ids = ["gdp-per-capita", "hdi", "political-regime"];
    expect(FeaturedIndicators.parse(ids)).toEqual(ids);
    expect(country({ featured_indicators: ids }).data?.featured_indicators).toEqual(ids);
  });

  it("at most six, each once", () => {
    expect(FeaturedIndicators.safeParse(["a", "b", "c", "d", "e", "f"]).success).toBe(true);
    expect(
      FeaturedIndicators.safeParse(["a", "b", "c", "d", "e", "f", "g"]).error?.issues[0]?.message,
    ).toMatch(/At most 6/);
    expect(FeaturedIndicators.safeParse(["hdi", "gdp", "hdi"]).error?.issues[0]?.message).toBe(
      "Each indicator only once.",
    );
    expect(FeaturedIndicators.safeParse([]).success).toBe(true);
  });
});
