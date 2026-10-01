import type {
  CellValue,
  ColumnDef,
  DataTableRow,
  FilterOption,
  FilterValue,
  SortState,
} from "./types";

/**
 * Search, column filters and sorting of the table — pure functions, so the
 * rules are unit-tested and the CSV export gets exactly the rows on screen.
 */

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

/** Text of a value as the user sees it (option label when the column has one). */
export function displayText(column: ColumnDef, value: CellValue): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map((item) => optionLabel(column, item)).join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return optionLabel(column, String(value));
}

function optionLabel(column: ColumnDef, value: string): string {
  return column.options?.find((option) => option.value === value)?.label ?? value;
}

/** Raw strings of a value for matching a select filter. */
function rawStrings(value: CellValue): string[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value.map(String);
  return [String(value)];
}

export function isActiveFilter(value: FilterValue | undefined): boolean {
  if (value === null || value === undefined) return false;
  return Array.isArray(value) ? value.length > 0 : value.trim() !== "";
}

export function activeFilterCount(filters: Record<string, FilterValue>): number {
  return Object.values(filters).filter(isActiveFilter).length;
}

/** Full-text search over all columns (raw value and its label), case-insensitive. */
function matchesSearch(row: DataTableRow, columns: readonly ColumnDef[], search: string) {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return columns.some((column) => {
    const value = row.values[column.key];
    const haystack = `${rawStrings(value).join(" ")} ${displayText(column, value)}`;
    return haystack.toLowerCase().includes(needle);
  });
}

function matchesFilter(row: DataTableRow, column: ColumnDef, filter: FilterValue): boolean {
  if (!isActiveFilter(filter)) return true;
  const value = row.values[column.key];
  if (Array.isArray(filter)) {
    const raw = rawStrings(value);
    return filter.some((wanted) => raw.includes(wanted));
  }
  const needle = (filter as string).trim().toLowerCase();
  return displayText(column, value).toLowerCase().includes(needle);
}

/** Compares two values: empty last, numbers numerically, text naturally ("2" < "10"). */
export function compareValues(a: CellValue, b: CellValue): number {
  const emptyA = a === null || a === undefined || a === "";
  const emptyB = b === null || b === undefined || b === "";
  if (emptyA || emptyB) return emptyA === emptyB ? 0 : emptyA ? 1 : -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  const textA = Array.isArray(a) ? a.join(", ") : String(a);
  const textB = Array.isArray(b) ? b.join(", ") : String(b);
  return collator.compare(textA, textB);
}

export function sortRows<R extends DataTableRow>(rows: readonly R[], sort: SortState | null): R[] {
  if (!sort) return [...rows];
  const dir = sort.dir === "asc" ? 1 : -1;
  // Empty values stay at the bottom in both directions.
  return [...rows].sort((a, b) => {
    const va = a.values[sort.key];
    const vb = b.values[sort.key];
    const emptyA = va === null || va === undefined || va === "";
    const emptyB = vb === null || vb === undefined || vb === "";
    if (emptyA || emptyB) return compareValues(va, vb);
    return compareValues(va, vb) * dir;
  });
}

export interface ProcessInput<R extends DataTableRow> {
  rows: readonly R[];
  columns: readonly ColumnDef[];
  search: string;
  filters: Record<string, FilterValue>;
  sort: SortState | null;
}

/** Search → column filters → sort: the rows the table (and the CSV) shows. */
export function processRows<R extends DataTableRow>({
  rows,
  columns,
  search,
  filters,
  sort,
}: ProcessInput<R>): R[] {
  const byKey = new Map(columns.map((column) => [column.key, column]));
  const active = Object.entries(filters).filter(
    ([key, value]) => byKey.has(key) && isActiveFilter(value),
  );
  const kept = rows.filter(
    (row) =>
      matchesSearch(row, columns, search) &&
      active.every(([key, value]) => matchesFilter(row, byKey.get(key)!, value)),
  );
  return sortRows(kept, sort);
}

/** Options of a select filter: the column's own, else the distinct values of the rows. */
export function filterOptions(column: ColumnDef, rows: readonly DataTableRow[]): FilterOption[] {
  if (column.options?.length) return [...column.options];
  const seen = new Set<string>();
  for (const row of rows) for (const value of rawStrings(row.values[column.key])) seen.add(value);
  return [...seen].sort(collator.compare).map((value) => ({ value, label: value }));
}

/** Number of rows whose column holds the value (KPI chips). */
export function countWhere(rows: readonly DataTableRow[], column: string, value: string): number {
  return rows.filter((row) => rawStrings(row.values[column]).includes(value)).length;
}
