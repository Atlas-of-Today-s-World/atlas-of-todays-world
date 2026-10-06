import { describe, expect, it } from "vitest";
import { filterFromParams, matchesFilter, type PlaceIndex } from "./filter";

const places: PlaceIndex = {
  regionOf: { CZE: "europe", NER: "africa" },
  specialsOf: { NER: ["sahel"] },
};
const europe = { region: "europe", issue: null, countries: [] };
const czech = { region: null, issue: null, countries: ["CZE"] };
const sahel = { region: null, issue: "sahel", countries: [] };

describe("Topics filter", () => {
  it("a country gets its own topics, its region's and its groups'", () => {
    const czechia = { kind: "country", value: "CZE" } as const;
    expect([europe, czech, sahel].filter((t) => matchesFilter(t, czechia, places))).toEqual([
      europe,
      czech,
    ]);
    const niger = { kind: "country", value: "NER" } as const;
    expect([europe, czech, sahel].filter((t) => matchesFilter(t, niger, places))).toEqual([sahel]);
  });

  it("a region or special region gets the topics placed on it", () => {
    expect(matchesFilter(europe, { kind: "region", value: "europe" }, places)).toBe(true);
    expect(matchesFilter(czech, { kind: "region", value: "europe" }, places)).toBe(false);
    expect(matchesFilter(sahel, { kind: "special", value: "sahel" }, places)).toBe(true);
  });

  it("reads exactly one filter from the URL", () => {
    expect(filterFromParams(new URLSearchParams("region=europe"))).toEqual({
      kind: "region",
      value: "europe",
    });
    expect(filterFromParams(new URLSearchParams("country=CZE&region=europe"))?.kind).toBe(
      "country",
    );
    expect(filterFromParams(new URLSearchParams("q=boats"))).toBeNull();
  });
});
