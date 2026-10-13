import { describe, expect, it } from "vitest";
import type { Country, IndicatorData } from "@/features/geography/types";
import { groupStats, population } from "./region-stats";

const country = (iso3: string, people: number | null) =>
  ({ iso3, population: people }) as unknown as Country;

const layer = (
  patch: Partial<IndicatorData> & Pick<IndicatorData, "id" | "values">,
): IndicatorData => ({
  label: patch.id,
  shortLabel: patch.id,
  description: "",
  unit: "",
  decimals: 1,
  source: "Source",
  sourceUrl: "https://example.org",
  type: "sequential",
  higherIsBetter: true,
  latestYear: 2024,
  countryCount: Object.keys(patch.values).length,
  ...patch,
});

const group = [country("AAA", 300), country("BBB", 100), country("CCC", null)];

describe("groupStats", () => {
  it("averages a scale weighted by population, with coverage and the latest year", () => {
    const hdi = layer({
      id: "hdi",
      values: { AAA: { value: 0.8, year: 2022 }, BBB: { value: 0.4, year: 2023 } },
    });
    expect(groupStats(group, [hdi])).toEqual([
      {
        id: "hdi",
        label: "hdi",
        shortLabel: "hdi",
        value: "0.7",
        coverage: { have: 2, total: 3 },
        year: 2023,
        source: "Source",
        sourceUrl: "https://example.org",
      },
    ]);
  });

  it("takes the most common category of a categorical layer", () => {
    const regime = layer({
      id: "political-regime",
      type: "categorical",
      categories: [
        { value: 1, label: "Autocracy", color: "#000000" },
        { value: 2, label: "Democracy", color: "#ffffff" },
      ],
      values: {
        AAA: { value: 1, year: 2024 },
        BBB: { value: 2, year: 2024 },
        CCC: { value: 2, year: 2024 },
      },
    });
    expect(groupStats(group, [regime])[0]?.value).toBe("Democracy");
  });

  it("shows the card layers in their order and skips those without the group's data", () => {
    const stats = groupStats(group, [
      layer({ id: "internet-users", values: { AAA: { value: 50, year: 2024 } } }),
      layer({ id: "hdi", values: { AAA: { value: 0.8, year: 2024 } } }),
      layer({ id: "corruption", values: { ZZZ: { value: 10, year: 2024 } } }),
      layer({ id: "not-a-card", values: { AAA: { value: 1, year: 2024 } } }),
    ]);
    expect(stats.map((stat) => stat.id)).toEqual(["hdi", "internet-users"]);
  });

  it("sums the population of the group", () => {
    expect(population(group)).toBe(400);
  });
});
