import { displayText } from "./rows";
import type { CellValue, ColumnDef, DataTableRow } from "./types";

/**
 * CSV export of the rows on screen (after search, filters and sort). Runs in
 * the browser — nothing goes to the server.
 *
 * - UTF-8 with BOM, so Excel shows diacritics;
 * - comma separator and CRLF (RFC 4180);
 * - every field quoted; quotes doubled;
 * - a leading `= + - @` gets an apostrophe so a spreadsheet does not run it
 *   as a formula (CSV injection, OWASP).
 */

const FORMULA = /^[=+\-@\t\r]/;

export function escapeCsvCell(text: string): string {
  // A plain negative number (-12.5) stays a number.
  const safe = FORMULA.test(text) && !Number.isFinite(Number(text)) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

function exportText(column: ColumnDef, value: CellValue): string {
  if (Array.isArray(value)) return value.map((item) => displayText(column, item)).join("; ");
  return displayText(column, value);
}

export function rowsToCsv(columns: readonly ColumnDef[], rows: readonly DataTableRow[]): string {
  const header = columns.map((column) => escapeCsvCell(column.label)).join(",");
  const body = rows.map((row) =>
    columns.map((column) => escapeCsvCell(exportText(column, row.values[column.key]))).join(","),
  );
  return [header, ...body].join("\r\n");
}

/** Safe file name: letters, digits, dash; `.csv` and today's date appended. */
export function csvFileName(base: string, today = new Date()): string {
  const slug =
    base
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "export";
  return `${slug}-${today.toISOString().slice(0, 10)}.csv`;
}

/** Downloads the CSV text as a file (browser only). */
export function downloadCsv(fileName: string, csv: string): void {
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
