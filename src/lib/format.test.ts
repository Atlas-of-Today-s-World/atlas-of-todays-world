import { describe, expect, it } from "vitest";
import { formatDateTime, formatLongDate, formatNumber, formatPopulation, isoDay } from "./format";

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

  it("admin date and time, the same as the British medium/short format", () => {
    const at = new Date(2026, 9, 3, 14, 5);
    expect(formatDateTime(at)).toBe(
      new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(at),
    );
    expect(formatDateTime(at.toISOString())).toBe(formatDateTime(at));
    expect(formatDateTime(at)).toMatch(/^3 Oct 2026, 14:05$/);
  });

  it("UTC day for file names", () => {
    expect(isoDay(new Date("2026-10-03T23:30:00Z"))).toBe("2026-10-03");
    expect(isoDay()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
