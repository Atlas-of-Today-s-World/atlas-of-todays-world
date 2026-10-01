import { describe, expect, it } from "vitest";
import { csvFileName, escapeCsvCell, rowsToCsv } from "./csv";
import { processRows } from "./rows";
import type { ColumnDef, DataTableRow } from "./types";

const columns: ColumnDef[] = [
  { key: "name", label: "Name" },
  { key: "status", label: "Status", options: [{ value: "draft", label: "Draft" }] },
  { key: "tags", label: "Tags", kind: "tags" },
  { key: "active", label: "Active", kind: "boolean" },
];

const rows: DataTableRow[] = [
  { id: "1", values: { name: 'Say "hi"', status: "draft", tags: ["a", "b"], active: true } },
  { id: "2", values: { name: "Line\nbreak, comma", status: null, tags: [], active: false } },
];

describe("escapeCsvCell", () => {
  it("quotes every cell and doubles quotes", () => {
    expect(escapeCsvCell('a "b"')).toBe('"a ""b"""');
  });

  it("defuses spreadsheet formulas (CSV injection)", () => {
    expect(escapeCsvCell("=HYPERLINK(1)")).toBe(`"'=HYPERLINK(1)"`);
    expect(escapeCsvCell("@SUM(A1)")).toBe(`"'@SUM(A1)"`);
    expect(escapeCsvCell("+1+2")).toBe(`"'+1+2"`);
  });

  it("keeps plain negative numbers as numbers", () => {
    expect(escapeCsvCell("-12.5")).toBe('"-12.5"');
  });
});

describe("rowsToCsv", () => {
  it("writes a header, labels instead of codes, tags joined, CRLF lines", () => {
    expect(rowsToCsv(columns, rows)).toBe(
      [
        '"Name","Status","Tags","Active"',
        '"Say ""hi""","Draft","a; b","Yes"',
        '"Line\nbreak, comma","","","No"',
      ].join("\r\n"),
    );
  });

  it("exports exactly the filtered and sorted rows", () => {
    const shown = processRows({
      rows,
      columns,
      search: "",
      filters: { status: ["draft"] },
      sort: null,
    });
    expect(rowsToCsv(columns.slice(0, 1), shown).split("\r\n")).toEqual(['"Name"', '"Say ""hi"""']);
  });
});

describe("csvFileName", () => {
  it("slugifies the name and appends the date", () => {
    expect(csvFileName("Entries – Čeština!", new Date("2026-10-01T12:00:00Z"))).toBe(
      "entries-cestina-2026-10-01.csv",
    );
    expect(csvFileName("***", new Date("2026-10-01T12:00:00Z"))).toBe("export-2026-10-01.csv");
  });
});
