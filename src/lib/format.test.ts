import { describe, expect, it } from "vitest";
import { formatLongDate, formatNumber, formatPopulation } from "./format";

describe("numbers and dates (English)", () => {
  it("decimal point and thousands separator", () => {
    expect(formatNumber(0.9151, 3)).toBe("0.915");
    expect(formatNumber(49292, 0, "en")).toBe("49,292");
  });

  it("population with a unit", () => {
    expect(formatPopulation(10_700_000)).toBe("10.7 m");
    expect(formatPopulation(1_430_000_000)).toBe("1.43 bn");
    expect(formatPopulation(null)).toBe("—");
  });

  it("long date", () => {
    expect(formatLongDate("2026-10-03")).toBe("3 October 2026");
  });
});
