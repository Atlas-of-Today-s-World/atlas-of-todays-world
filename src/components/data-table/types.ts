import type { ReactNode } from "react";
import type { Tone } from "@/components/ui/badge";

export type { Tone };

/**
 * Types of the one admin table (ARCHITEKTURA 15.1 — "tables → DataTable").
 *
 * Everything a page passes in is plain data, so a Server Component page can
 * hand rows straight to the client table: values for sorting, filtering,
 * search and CSV, and optional pre-rendered `cells` / `actions` for the few
 * cells that need a link or a button. No column carries a function.
 */

/** Raw value of one cell; arrays are tags. Dates travel as ISO strings. */
export type CellValue = string | number | boolean | null | undefined | readonly string[];

/** How a value is rendered when the row brings no pre-rendered cell. */
type CellKind =
  "text" | "number" | "date" | "datetime" | "badge" | "tags" | "code" | "boolean" | "color";

export interface FilterOption {
  value: string;
  label: string;
  tone?: Tone;
}

/** `text` = contains; `select` = one of the options. Options default to distinct values. */
type FilterKind = "text" | "select" | "none";

/** Filter of one column. `null` = no filter. */
export type FilterValue = string | string[] | null;

export interface ColumnDef<K extends string = string> {
  key: K;
  label: string;
  kind?: CellKind;
  /** Badge / tag labels and tones per raw value (also the filter options). */
  options?: readonly FilterOption[];
  sortable?: boolean;
  filter?: FilterKind;
  /** CSS grid track, fixed or fractional (never content-dependent, see gridTemplate). */
  width?: string;
  align?: "left" | "right" | "center";
  /** Render the value as a link to `row.href` (the row's primary column). */
  link?: boolean;
  /** Hidden by default; the user can turn it on in "Columns". */
  hidden?: boolean;
  /** Leave out of CSV export (e.g. a colour swatch). */
  noExport?: boolean;
}

export interface DataTableRow<K extends string = string> {
  /** Stable key (selection, React key). */
  id: string;
  values: Partial<Record<K, CellValue>>;
  /** Pre-rendered cell content (links, buttons) overriding the built-in render. */
  cells?: Partial<Record<K, ReactNode>>;
  /** Target of the `link` column. */
  href?: string;
  /** Content of the sticky Actions column (usually `<RowActions/>`). */
  actions?: ReactNode;
}

export interface SortState {
  key: string;
  dir: "asc" | "desc";
}

export interface TablePreferences {
  columnOrder: string[];
  hiddenColumns: string[];
  pageSize: number;
  sort: SortState | null;
  /** Per-column width in px, overrides ColumnDef.width. */
  columnWidths: Record<string, number>;
  search: string;
  filters: Record<string, FilterValue>;
}

/**
 * KPI chip above the table. Its count is computed from the loaded rows; a chip
 * with `column` + `value` filters the table to that value when clicked.
 */
export interface StatDef<K extends string = string> {
  key: string;
  label: string;
  tone?: Tone;
  column?: K;
  value?: string;
}
