import { describe, expect, it } from "vitest";
import {
  activeFilterCount,
  compareValues,
  countWhere,
  displayText,
  filterOptions,
  processRows,
  sortRows,
} from "./rows";
import type { ColumnDef, DataTableRow } from "./types";

type Key = "title" | "status" | "words" | "tags";

const columns: ColumnDef<Key>[] = [
  { key: "title", label: "Title", filter: "text" },
  {
    key: "status",
    label: "Status",
    kind: "badge",
    filter: "select",
    options: [
      { value: "draft", label: "Draft" },
      { value: "published", label: "Published", tone: "success" },
    ],
  },
  { key: "words", label: "Words", kind: "number" },
  { key: "tags", label: "Tags", kind: "tags", filter: "select" },
];

const row = (
  id: string,
  title: string,
  status: string,
  words: number | null,
  tags: string[] = [],
): DataTableRow<Key> => ({ id, values: { title, status, words, tags } });

const rows = [
  row("1", "Elections in Moldova", "published", 1200, ["europe", "politics"]),
  row("2", "Water crisis in Iran", "draft", 300, ["asia"]),
  row("3", "Item 10", "draft", null),
  row("4", "Item 2", "published", 90, ["europe"]),
];

const ids = (list: DataTableRow[]) => list.map((item) => item.id);
const run = (patch: Partial<Parameters<typeof processRows>[0]>) =>
  processRows({ rows, columns, search: "", filters: {}, sort: null, ...patch });

describe("search", () => {
  it("is case-insensitive over all columns", () => {
    expect(ids(run({ search: "MOLDOVA" }))).toEqual(["1"]);
  });

  it("matches option labels, not only raw values", () => {
    expect(ids(run({ search: "Published" }))).toEqual(["1", "4"]);
  });

  it("matches tags", () => {
    expect(ids(run({ search: "asia" }))).toEqual(["2"]);
  });

  it("ignores surrounding whitespace", () => {
    expect(run({ search: "   " })).toHaveLength(4);
  });
});

describe("column filters", () => {
  it("text filter = contains", () => {
    expect(ids(run({ filters: { title: "crisis" } }))).toEqual(["2"]);
  });

  it("select filter = any of the chosen values", () => {
    expect(ids(run({ filters: { status: ["draft"] } }))).toEqual(["2", "3"]);
  });

  it("select filter on tags matches any tag", () => {
    expect(ids(run({ filters: { tags: ["europe"] } }))).toEqual(["1", "4"]);
  });

  it("combines search and filters", () => {
    expect(ids(run({ search: "item", filters: { status: ["published"] } }))).toEqual(["4"]);
  });

  it("ignores empty filters and unknown columns", () => {
    expect(run({ filters: { status: [], title: "", nope: "x" } })).toHaveLength(4);
    expect(activeFilterCount({ status: [], title: " ", words: "1" })).toBe(1);
  });
});

describe("sorting", () => {
  it("sorts numbers numerically and keeps empty values last in both directions", () => {
    expect(ids(sortRows(rows, { key: "words", dir: "asc" }))).toEqual(["4", "2", "1", "3"]);
    expect(ids(sortRows(rows, { key: "words", dir: "desc" }))).toEqual(["1", "2", "4", "3"]);
  });

  it("sorts text naturally (Item 2 before Item 10)", () => {
    expect(ids(run({ search: "item", sort: { key: "title", dir: "asc" } }))).toEqual(["4", "3"]);
  });

  it("does not mutate the input", () => {
    const before = ids(rows);
    sortRows(rows, { key: "title", dir: "desc" });
    expect(ids(rows)).toEqual(before);
  });

  it("compares mixed values predictably", () => {
    expect(compareValues(true, false)).toBeGreaterThan(0);
    expect(compareValues(null, undefined)).toBe(0);
    expect(compareValues("a", "")).toBeLessThan(0);
  });
});

describe("helpers", () => {
  it("displayText uses option labels and Yes/No", () => {
    expect(displayText(columns[1]!, "draft")).toBe("Draft");
    expect(displayText(columns[0]!, true)).toBe("Yes");
    expect(displayText(columns[3]!, ["a", "b"])).toBe("a, b");
  });

  it("filterOptions falls back to sorted distinct values", () => {
    expect(filterOptions(columns[3]!, rows).map((option) => option.value)).toEqual([
      "asia",
      "europe",
      "politics",
    ]);
    expect(filterOptions(columns[1]!, rows)).toHaveLength(2);
  });

  it("countWhere counts KPI chips", () => {
    expect(countWhere(rows, "status", "draft")).toBe(2);
    expect(countWhere(rows, "tags", "europe")).toBe(2);
  });
});
