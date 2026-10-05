import { describe, expect, it } from "vitest";
import type { AtlasSnapshot } from "@/features/geography/model";
import { localePath } from "./config";
import { localizeSnapshot } from "./translatable";

const snapshot = {
  regions: [{ slug: "east-asia", name: "East Asia", tagline: "T", summary: "S", fill: "#fff" }],
  countries: [{ iso3: "BRA", name: "Brazil", blurb: null, population: 1 }],
  issues: [],
  indicators: [{ id: "hdi", label: "HDI", short_label: "HDI", description: "D", decimals: 3 }],
} as unknown as AtlasSnapshot;

describe("localizeSnapshot", () => {
  it("overrides only allowed fields and leaves the rest in English", () => {
    const out = localizeSnapshot(snapshot, [
      { entity: "country", entity_key: "BRA", field: "name", value: "Brazílie" },
      { entity: "country", entity_key: "BRA", field: "population", value: "99" },
      { entity: "region", entity_key: "east-asia", field: "summary", value: "Shrnutí" },
      { entity: "indicator", entity_key: "hdi", field: "label", value: "  " },
    ]);
    expect(out.countries[0]).toMatchObject({ name: "Brazílie", population: 1 });
    expect(out.regions[0]).toMatchObject({ name: "East Asia", summary: "Shrnutí" });
    expect(out.indicators[0]?.label).toBe("HDI");
  });

  it("without translations returns the same snapshot", () => {
    expect(localizeSnapshot(snapshot, [])).toBe(snapshot);
  });
});

describe("localePath", () => {
  it("English without a prefix", () => {
    expect(localePath("en", "/country/brazil")).toBe("/country/brazil");
    expect(localePath("en", "/")).toBe("/");
    expect(localePath("en", "about")).toBe("/about");
  });
});
