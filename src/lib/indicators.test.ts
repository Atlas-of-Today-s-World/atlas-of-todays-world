import { describe, expect, it } from "vitest";
import type { Indicator } from "@/features/geography/types";
import { formatValue } from "./indicators";

const indicator = (patch: Partial<Indicator>): Indicator => ({
  id: "x",
  label: "X",
  shortLabel: "X",
  description: "",
  unit: "",
  decimals: 1,
  source: "",
  sourceUrl: "",
  type: "sequential",
  higherIsBetter: true,
  latestYear: 2024,
  countryCount: 1,
  values: {},
  ...patch,
});

describe("formatValue", () => {
  it("puts a currency symbol in front of the number", () => {
    expect(formatValue(indicator({ id: "gdp-per-capita", unit: " $" }), 4579.4)).toBe("$4,579");
  });

  it("keeps other units after the number", () => {
    expect(formatValue(indicator({ unit: " yrs" }), 72.06)).toBe("72.1 yrs");
    expect(formatValue(indicator({ unit: "%" }), 12.5)).toBe("12.5%");
  });

  it("names a category instead of a number", () => {
    const regime = indicator({
      type: "categorical",
      categories: [{ value: 1, label: "Closed autocracy", color: "#000" }],
    });
    expect(formatValue(regime, 1)).toBe("Closed autocracy");
  });
});
