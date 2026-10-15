import { describe, expect, it } from "vitest";
import { COLLECTIONS, CountryInput, FeaturedIndicators, RegionInput } from "./schema";

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

const CHART = "https://datawrapper.dwcdn.net/aB3dE/2/";
const EMBED = `<iframe title="Chart" id="datawrapper-chart-aB3dE" src="${CHART}" scrolling="no" height="420"></iframe><script type="text/javascript">!function(){}();</script>`;

const visual = (item: Record<string, unknown>) =>
  COLLECTIONS.visuals.safeParse({ title: "Refugees", ...item });

describe("portrait visuals", () => {
  it("keeps only the chart URL from pasted Datawrapper embed code", () => {
    const parsed = visual({ provider: "datawrapper", url: EMBED });
    expect(parsed.success && parsed.data).toEqual({
      provider: "datawrapper",
      title: "Refugees",
      caption: "",
      url: CHART,
    });
  });

  it("switches the type to Datawrapper when a chart is pasted under another type", () => {
    const parsed = visual({ provider: "image", url: EMBED });
    expect(parsed.success && parsed.data.provider).toBe("datawrapper");
  });

  it("refuses a Datawrapper item that isn't a Datawrapper chart, with a hint", () => {
    for (const url of [
      `<iframe src="https://evil.example/aB3dE/2/"></iframe>`,
      "https://datawrapper.dwcdn.net.evil.com/aB3dE/2/",
      `<iframe srcdoc="<script>alert(1)</script>" src="${CHART}"></iframe>`,
    ]) {
      const parsed = visual({ provider: "datawrapper", url });
      expect(parsed.success).toBe(false);
      expect(parsed.error?.issues[0]?.path).toEqual(["url"]);
      expect(parsed.error?.issues[0]?.message).toMatch(/Datawrapper/);
    }
  });

  it("other types still need a plain https URL, and never keep pasted HTML", () => {
    expect(visual({ provider: "image", url: " https://example.org/map.png " }).data?.url).toBe(
      "https://example.org/map.png",
    );
    for (const url of [
      "http://example.org/map.png",
      `<iframe src="https://evil.example/"></iframe>`,
    ]) {
      const parsed = visual({ provider: "image", url });
      expect(parsed.error?.issues[0]?.message).toBe("The URL must start with https://.");
    }
    expect(visual({ provider: "youtube", url: "https://example.org/x" }).success).toBe(false);
  });

  it("passes a non-object through to the object check", () => {
    expect(COLLECTIONS.visuals.safeParse("x").success).toBe(false);
  });
});
