import { describe, expect, it } from "vitest";
import { CategoryInput, ImportInput, IndicatorInput } from "./schema";

describe("CategoryInput", () => {
  const category = { label: "Closed autocracy", color: "#8C2F39" };

  it("a category value fits a Postgres integer", () => {
    for (const value of ["0", "-2147483648", "2147483647"]) {
      expect(CategoryInput.safeParse({ ...category, value }).success).toBe(true);
    }
    for (const value of ["2147483648", "-2147483649", "1.5"]) {
      expect(CategoryInput.safeParse({ ...category, value }).success).toBe(false);
    }
  });

  it("stores the colour lowercase", () => {
    expect(CategoryInput.parse({ ...category, value: "1" }).color).toBe("#8c2f39");
  });
});

describe("IndicatorInput", () => {
  const indicator = {
    id: "hdi",
    label: "Human Development Index",
    short_label: "HDI",
    description: "",
    unit: "",
    decimals: "3",
    source: "UNDP",
    source_url: "",
    type: "sequential",
    scale: "linear",
    domain_min: "0.4",
    domain_max: "0.96",
    ramp: ["#f2f7c4", "#41b6c4"],
  };

  it("type and scale come from the one list each", () => {
    expect(IndicatorInput.safeParse(indicator).success).toBe(true);
    expect(IndicatorInput.safeParse({ ...indicator, type: "diverging" }).success).toBe(false);
    expect(IndicatorInput.safeParse({ ...indicator, scale: "sqrt" }).success).toBe(false);
  });

  it("at most 9 palette colours (the DB CHECK on ramp says the same)", () => {
    const ramp = (count: number) => Array.from({ length: count }, () => "#aabbcc");
    expect(IndicatorInput.safeParse({ ...indicator, ramp: ramp(9) }).success).toBe(true);
    expect(IndicatorInput.safeParse({ ...indicator, ramp: ramp(10) }).success).toBe(false);
  });
});

describe("ImportInput", () => {
  const row = { country_iso3: "CZE", value: 1.5, year: 2024, note: null };
  const input = { indicator_id: "hdi", replace: true, source_note: "UNDP", rows: [row] };
  const ok = (change: object) => ImportInput.safeParse({ ...input, ...change }).success;
  const rows = (...list: object[]) => ({ rows: list.map((item) => ({ ...row, ...item })) });
  /** `count` distinct three-letter codes. */
  const codes = (count: number) =>
    Array.from({ length: count }, (_, i) =>
      [26 * 26, 26, 1]
        .map((step) => String.fromCharCode(65 + (Math.floor(i / step) % 26)))
        .join(""),
    );

  it("takes a valid import and trims the source and notes", () => {
    const parsed = ImportInput.parse({
      ...input,
      source_note: "  World Bank  ",
      ...rows({ note: "  estimate " }, { country_iso3: "DEU", note: "  " }),
    });
    expect(parsed.source_note).toBe("World Bank");
    expect(parsed.rows.map((item) => item.note)).toEqual(["estimate", null]);
  });

  it("needs a source of at most 300 characters (the DB requires one on manual values)", () => {
    expect(ok({ source_note: " " })).toBe(false);
    expect(ok({ source_note: "x".repeat(300) })).toBe(true);
    expect(ok({ source_note: "x".repeat(301) })).toBe(false);
  });

  it("1 to 1000 rows, each country once", () => {
    expect(ok({ rows: [] })).toBe(false);
    expect(ok(rows(...codes(1000).map((country_iso3) => ({ country_iso3 }))))).toBe(true);
    expect(ok(rows(...codes(1001).map((country_iso3) => ({ country_iso3 }))))).toBe(false);
    expect(ok(rows({}, {}))).toBe(false);
  });

  it("values, years and notes within the database limits", () => {
    expect(ok(rows({ country_iso3: "cze" }))).toBe(false);
    expect(ok(rows({ value: Number.NaN }))).toBe(false);
    expect(ok(rows({ value: Number.POSITIVE_INFINITY }))).toBe(false);
    expect(ok(rows({ value: "1.5" }))).toBe(false);
    expect(ok(rows({ year: null }))).toBe(true);
    expect(ok(rows({ year: 1800 }))).toBe(true);
    expect(ok(rows({ year: 2101 }))).toBe(false);
    expect(ok(rows({ year: 2024.5 }))).toBe(false);
    expect(ok(rows({ note: "x".repeat(120) }))).toBe(true);
    expect(ok(rows({ note: "x".repeat(121) }))).toBe(false);
    expect(ok({ replace: "yes" })).toBe(false);
    expect(ok({ indicator_id: "Not a slug!" })).toBe(false);
  });
});
