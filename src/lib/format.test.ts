import { describe, expect, it } from "vitest";
import { formatLongDate, formatNumber, formatPopulation } from "./format";

describe("numbers and dates by language", () => {
  it("decimal point in English, comma in Czech", () => {
    expect(formatNumber(0.9151, 3)).toBe("0.915");
    expect(formatNumber(0.9151, 3, "cs")).toBe("0,915");
    expect(formatNumber(49292, 0, "en")).toBe("49,292");
    expect(formatNumber(49292, 0, "cs").replace(/\s/g, " ")).toBe("49 292");
  });

  it("population with the language's unit", () => {
    expect(formatPopulation(10_700_000)).toBe("10.7 m");
    expect(formatPopulation(10_700_000, "cs")).toBe("10,7 mil.");
    expect(formatPopulation(1_430_000_000, "cs")).toBe("1,43 mld.");
    expect(formatPopulation(null)).toBe("—");
  });

  it("date in Czech", () => {
    expect(formatLongDate("2026-10-03", "cs")).toBe("3. října 2026");
    expect(formatLongDate("2026-10-03")).toBe("3 October 2026");
  });
});
