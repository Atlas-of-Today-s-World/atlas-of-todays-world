import { describe, expect, it } from "vitest";
import { countryMatcher } from "@/features/geography/country-match";
import { parseCsv } from "@/lib/csv";
import {
  buildPreview,
  detectDecimalMark,
  guessMapping,
  parseCategory,
  parseNumber,
  parseYear,
  SKIP,
  toTable,
  yearInHeading,
  type CurrentValue,
  type Table,
} from "./import-model";

const match = countryMatcher([
  { iso3: "CZE", iso2: "CZ", name: "Czechia", nameFormal: "Czech Republic" },
  { iso3: "DEU", iso2: "DE", name: "Germany", nameFormal: "Federal Republic of Germany" },
  { iso3: "FRA", iso2: null, name: "France", nameFormal: "French Republic" },
  { iso3: "POL", iso2: "PL", name: "Poland", nameFormal: "Republic of Poland" },
  { iso3: "KOR", iso2: "KR", name: "South Korea", nameFormal: "Republic of Korea" },
]);

const table = (text: string): Table => {
  const found = toTable(parseCsv(text));
  if (!found) throw new Error("no table");
  return found;
};

describe("numbers", () => {
  it("reads the decimal mark the column uses", () => {
    expect(detectDecimalMark(["1.5", "2", "3.25"])).toBe(".");
    expect(detectDecimalMark(["1,5", "2", "3,25"])).toBe(",");
    expect(detectDecimalMark(["1,234.5", "2"])).toBe(".");
    expect(detectDecimalMark(["1.234,5", "2"])).toBe(",");
    expect(detectDecimalMark(["1,234,567", "2,5"])).toBe(".");
    expect(detectDecimalMark(["1.234.567"])).toBe(",");
    expect(detectDecimalMark(["1 234,5", "..", ""])).toBe(",");
    expect(detectDecimalMark(["1,5", "2.5"])).toBe(".");
    expect(detectDecimalMark(["", ".."])).toBe(".");
  });

  it("parses numbers with a dot", () => {
    expect(parseNumber("1234.5", ".")).toBe(1234.5);
    expect(parseNumber("1,234.5", ".")).toBe(1234.5);
    expect(parseNumber(" 1 234.5 ", ".")).toBe(1234.5);
    expect(parseNumber("1\u202f234", ".")).toBe(1234);
    expect(parseNumber("-0.25", ".")).toBe(-0.25);
    expect(parseNumber("\u22120.25", ".")).toBe(-0.25);
    expect(parseNumber("+3", ".")).toBe(3);
    expect(parseNumber(".5", ".")).toBe(0.5);
    expect(parseNumber("1.2e-5", ".")).toBe(0.000012);
    expect(parseNumber("12.5%", ".")).toBe(12.5);
  });

  it("parses numbers with a comma", () => {
    expect(parseNumber("12,5", ",")).toBe(12.5);
    expect(parseNumber("1 234,5", ",")).toBe(1234.5);
    expect(parseNumber("1.234,5", ",")).toBe(1234.5);
    expect(parseNumber("1.234.567", ",")).toBe(1234567);
    expect(parseNumber("12,5 %", ",")).toBe(12.5);
  });

  it("empty and missing-data marks are no value; the rest is no number", () => {
    for (const cell of ["", " ", "..", "n/a", "NA", "-", "–", "…"]) {
      expect(parseNumber(cell, "."), cell).toBeNull();
    }
    for (const cell of ["abc", "1,2,3", "1.2.3", "12,34.5", "1.", "1e5x", "+", "5 kg", "0x10"]) {
      expect(parseNumber(cell, "."), cell).toBeUndefined();
    }
    expect(parseNumber("1,2,3", ",")).toBeUndefined();
    expect(parseNumber("1e5", ",")).toBeUndefined();
  });

  it("years: whole numbers from 1800 to 2100", () => {
    expect(parseYear("2024")).toBe(2024);
    expect(parseYear("2024.0")).toBe(2024);
    expect(parseYear("")).toBeNull();
    expect(parseYear("1799")).toBeUndefined();
    expect(parseYear("2101")).toBeUndefined();
    expect(parseYear("24")).toBeUndefined();
    expect(yearInHeading("2022")).toBe(2022);
    expect(yearInHeading("2022 [YR2022]")).toBe(2022);
    expect(yearInHeading("Value")).toBeNull();
    expect(yearInHeading("12345")).toBeNull();
  });

  it("categories: the code or the label", () => {
    const categories = [
      { value: 0, label: "Closed autocracy" },
      { value: 3, label: "Liberal democracy" },
    ];
    expect(parseCategory("3", categories)).toBe(3);
    expect(parseCategory(" liberal DEMOCRACY ", categories)).toBe(3);
    expect(parseCategory("2", categories)).toBeUndefined();
    expect(parseCategory("1.5", categories)).toBeUndefined();
    expect(parseCategory("Monarchy", categories)).toBeUndefined();
    expect(parseCategory("", categories)).toBeNull();
    expect(parseCategory("7", [])).toBe(7);
  });
});

describe("toTable and guessMapping", () => {
  it("a simple file: country names, a value, a year and a note", () => {
    const t = table("Country,Value,Year,Notes\nCzechia,1.5,2024,estimate\nGermany,2.5,2023,");
    expect(t.header).toEqual(["Country", "Value", "Year", "Notes"]);
    expect(guessMapping(t, match, null)).toEqual({
      country: 0,
      value: 1,
      year: 2,
      note: 3,
      decimal: "auto",
      defaultYear: null,
    });
  });

  it("a World Bank download: title lines skipped, code column, newest nearly full year", () => {
    const t = table(
      [
        '"Data Source","World Development Indicators",',
        "",
        '"Last Updated Date","2026-07-01",',
        "",
        '"Country Name","Country Code","Indicator Name","Indicator Code","2022","2023","2024",',
        '"Czechia","CZE","GDP","NY.GDP","1","2","",',
        '"Germany","DEU","GDP","NY.GDP","3","4","",',
        '"Poland","POL","GDP","NY.GDP","5","6","7",',
        '"World","WLD","GDP","NY.GDP","8","9","",',
      ].join("\n"),
    );
    expect(t.headerIndex).toBe(2);
    const mapping = guessMapping(t, match, null);
    expect(mapping).toMatchObject({ country: 1, value: 5, year: -1, note: -1, defaultYear: 2023 });
  });

  it("an OWID file: the code column wins a tie with the name column", () => {
    const t = table(
      "Entity,Code,Year,Share\nCzechia,CZE,2023,1\nGermany,DEU,2023,2\nWorld,OWID_WRL,2023,3",
    );
    expect(guessMapping(t, match, null)).toMatchObject({ country: 1, value: 3, year: 2 });
  });

  it("no table without a header and a data row", () => {
    expect(toTable(parseCsv("just one cell"))).toBeNull();
  });
});

describe("buildPreview", () => {
  const current: CurrentValue[] = [
    { country_iso3: "CZE", value: 1, year: 2020, note: null },
    { country_iso3: "DEU", value: 2, year: 2023, note: null },
    { country_iso3: "FRA", value: 3, year: 2023, note: null },
  ];

  const preview = (
    text: string,
    options: { replace?: boolean; choices?: Record<string, string>; country?: number } = {},
  ) => {
    const t = table(text);
    const guessed = guessMapping(t, match, null);
    return buildPreview({
      table: t,
      mapping: { ...guessed, country: options.country ?? guessed.country },
      match,
      choices: options.choices ?? {},
      categories: null,
      current,
      replace: options.replace ?? false,
    });
  };

  it("matches, compares with the current values and counts", () => {
    const result = preview(
      [
        "Country,Value,Year",
        "Czech Republic,1.5,2024",
        "DE,2,2023",
        "Poland,4,2024",
        "World,9,2024",
        "Upper middle income,9,2024",
        "Atlantis,5,2024",
        "Korea,6,2024",
        "France,..,2024",
        "PL,oops,2024",
        "CZ,1,1700",
        ",7,2024",
      ].join("\n"),
      { replace: true },
    );
    expect(result.rows).toEqual([
      { country_iso3: "CZE", value: 1.5, year: 2024, note: null },
      { country_iso3: "DEU", value: 2, year: 2023, note: null },
      { country_iso3: "POL", value: 4, year: 2024, note: null },
    ]);
    expect(result.counts).toMatchObject({
      add: 1,
      change: 1,
      same: 1,
      remove: 1, // France: its row has no value, so with "replace" it goes
      error: 2,
      aggregates: 2,
      duplicates: 0,
    });
    expect(result.unmatched).toEqual([
      { cell: "Atlantis", rows: [7] },
      { cell: "Korea", rows: [8] },
    ]);
    const byRow = (row: number) => result.lines.find((line) => line.row === row);
    expect(byRow(10)?.message).toMatch(/“oops” is not a number/);
    expect(byRow(11)?.message).toMatch(/not a year/);
    expect(byRow(12)?.message).toMatch(/No country/);
  });

  it("update only: nothing is removed", () => {
    const result = preview("Country,Value\nCzechia,1");
    expect(result.counts.remove).toBe(0);
    expect(result.lines.some((line) => line.status === "remove")).toBe(false);
  });

  it("the editor's choices map or skip unmatched names", () => {
    // No cell matches by itself, so the editor picked the country column too.
    const result = preview("Country,Value\nKorea,5\nAtlantis,1\nAtlantis,2", {
      choices: { Korea: "KOR", Atlantis: SKIP },
      country: 0,
    });
    expect(result.rows).toEqual([{ country_iso3: "KOR", value: 5, year: null, note: null }]);
    expect(result.unmatched.map((item) => item.cell)).toEqual(["Korea", "Atlantis"]);
    expect(result.lines.filter((line) => line.message === "Skipped by you.")).toHaveLength(2);
  });

  it("a country twice: the newest year wins, else the last row", () => {
    const longFormat = preview(
      "Entity,Code,Year,Value\nCzechia,CZE,2022,1\nCzechia,CZE,2024,3\nCzechia,CZE,2023,2",
    );
    expect(longFormat.rows).toEqual([{ country_iso3: "CZE", value: 3, year: 2024, note: null }]);
    expect(longFormat.counts.duplicates).toBe(2);

    const noYear = preview("Country,Value\nCzechia,1\nCZE,2");
    expect(noYear.rows).toEqual([{ country_iso3: "CZE", value: 2, year: null, note: null }]);
    expect(noYear.lines[0]?.message).toMatch(/row 3: the last row is kept/);
  });

  it("decimal commas in a semicolon file, and the year from the default", () => {
    const t = table("Země;Hodnota\nCzechia;1 234,5\nPoland;0,5");
    const mapping = { ...guessMapping(t, match, null), defaultYear: 2025 };
    const result = buildPreview({
      table: t,
      mapping,
      match,
      choices: {},
      categories: null,
      current: [],
      replace: false,
    });
    expect(result.decimal).toBe(",");
    expect(result.rows).toEqual([
      { country_iso3: "CZE", value: 1234.5, year: 2025, note: null },
      { country_iso3: "POL", value: 0.5, year: 2025, note: null },
    ]);
  });

  it("a note longer than the database takes is a row error", () => {
    const result = preview(`Country,Value,Note\nCzechia,1,${"x".repeat(121)}`);
    expect(result.counts.error).toBe(1);
    expect(result.rows).toEqual([]);
  });
});
