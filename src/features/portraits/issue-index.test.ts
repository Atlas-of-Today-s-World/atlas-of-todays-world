import { describe, expect, it } from "vitest";
import { issueFilters, matchesQuery } from "./issue-index";

const issues = [
  { slug: "war", countries: ["UKR", "POL", "RUS"] },
  { slug: "climate", countries: ["BGD", "MDV"] },
  { slug: "empty", countries: [] },
];
const regionOf = { UKR: "eastern-europe", POL: "europe", RUS: "eastern-europe", BGD: "south-asia" };

describe("issueFilters", () => {
  it("keeps the issues a country is a member of", () => {
    const filters = issueFilters(issues, { regionOf, customRegions: [] });
    expect(filters.country).toEqual({
      UKR: ["war"],
      POL: ["war"],
      RUS: ["war"],
      BGD: ["climate"],
      MDV: ["climate"],
    });
  });

  it("keeps an issue once in every region one of its countries is in", () => {
    const filters = issueFilters(issues, { regionOf, customRegions: [] });
    // MDV has no region: it adds nothing; two members in one region count once.
    expect(filters.region).toEqual({
      "eastern-europe": ["war"],
      europe: ["war"],
      "south-asia": ["climate"],
    });
  });

  it("keeps the issues sharing a country with a custom region", () => {
    const filters = issueFilters(issues, {
      regionOf,
      customRegions: [
        { slug: "v4", countries: ["POL", "CZE"] },
        { slug: "islands", countries: ["MDV", "UKR"] },
        { slug: "nordics", countries: ["NOR"] },
      ],
    });
    expect(filters["custom-region"]).toEqual({ v4: ["war"], islands: ["war", "climate"] });
  });
});

describe("matchesQuery", () => {
  const text = "Russia–Ukraine War The war and the states it reshaped Côte d’Ivoire";

  it("matches everything without a usable query", () => {
    expect(matchesQuery(text, "")).toBe(true);
    expect(matchesQuery(text, " a ")).toBe(true);
  });

  it("wants every word to start a word of the text, ignoring case and accents", () => {
    expect(matchesQuery(text, "ukr")).toBe(true);
    expect(matchesQuery(text, "WAR resh")).toBe(true);
    expect(matchesQuery(text, "cote")).toBe(true);
    expect(matchesQuery(text, "kraine")).toBe(false);
    expect(matchesQuery(text, "war climate")).toBe(false);
  });
});
