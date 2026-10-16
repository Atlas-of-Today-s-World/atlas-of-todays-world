/**
 * The data-layer CSV import, minus the screen: finding the header, guessing
 * the columns, reading numbers, matching countries and comparing the result
 * with the layer's current values. Pure and Zod-free (it runs in the browser;
 * the server validates the final rows again with ImportInput).
 */
import { normaliseName, type CountryMatch } from "@/features/geography/country-match";
import { IMPORT_LIMITS } from "./constants";

/** One row as the import sends it (and the RPC stores it). */
interface ImportRow {
  country_iso3: string;
  value: number;
  year: number | null;
  note: string | null;
}

export interface Category {
  value: number;
  label: string;
}

/** The file read into cells: the header row and the data rows below it. */
export interface Table {
  header: string[];
  rows: string[][];
  /** Index of the header among all records (spreadsheet row = index + 1). */
  headerIndex: number;
}

/**
 * The header is the first of the opening records with the most filled cells:
 * World Bank downloads start with a few title lines ("Data Source", "Last
 * Updated Date") above the real header.
 */
export function toTable(records: string[][]): Table | null {
  const filled = (row: string[]) => row.filter((cell) => cell.trim() !== "").length;
  let headerIndex = -1;
  let most = 0;
  records.slice(0, 10).forEach((row, index) => {
    if (filled(row) > most) {
      most = filled(row);
      headerIndex = index;
    }
  });
  if (headerIndex < 0 || most < 2) return null;
  const header = (records[headerIndex] ?? []).map(
    (cell, index) => cell.trim() || `Column ${index + 1}`,
  );
  return { header, rows: records.slice(headerIndex + 1), headerIndex };
}

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

export type DecimalMark = "." | ",";

/** Cells that mean "no value" (World Bank writes "..", others "n/a", "–"). */
const MISSING = new Set([
  "",
  "..",
  "...",
  "…",
  "-",
  "–",
  "—",
  "na",
  "n/a",
  "nan",
  "null",
  "none",
  "no data",
]);

/**
 * A cell without the characters numbers are dressed in: spaces of any width
 * (thousands groups "1 234,5"), a trailing "%" (12.5% is read as 12.5, the
 * number the layer's unit "%" expects) and the typographic minus.
 */
function bare(cell: string): string {
  return cell
    .trim()
    .replace(/[\s\u00a0\u2007\u2009\u202f]/g, "")
    .replace(/%$/, "")
    .replace(/^[\u2212\u2012–]/, "-");
}

const isMissing = (cell: string) => MISSING.has(cell.trim().toLowerCase());

/**
 * The decimal mark of a column, decided once for all its cells: where a cell
 * has both "," and ".", the later one is the decimal mark ("1,234.5",
 * "1.234,5"); two of the same mark are thousands groups ("1,234,567"); when
 * the only mark any cell uses is a single comma, it's a decimal comma
 * ("12,5"). Otherwise a dot.
 */
export function detectDecimalMark(cells: readonly string[]): DecimalMark {
  let comma = 0;
  let dot = 0;
  let commaOnly = 0;
  let dotOnly = 0;
  for (const raw of cells) {
    if (isMissing(raw)) continue;
    const cell = bare(raw);
    const commas = cell.split(",").length - 1;
    const dots = cell.split(".").length - 1;
    if (commas && dots) {
      if (cell.lastIndexOf(",") > cell.lastIndexOf(".")) comma += 1;
      else dot += 1;
    } else if (commas > 1) dot += 1;
    else if (dots > 1) comma += 1;
    else if (commas === 1) commaOnly += 1;
    else if (dots === 1) dotOnly += 1;
  }
  if (comma !== dot) return comma > dot ? "," : ".";
  return commaOnly > 0 && dotOnly === 0 ? "," : ".";
}

/**
 * The whole-number part with its thousands groups ("12,345,678" with ","):
 * digits only, or groups of exactly three after a first group of one to three
 * — so "1,2,3" is no number.
 */
function wholePart(text: string, thousands: string): string | undefined {
  if (!text.includes(thousands)) return /^\d*$/.test(text) ? text : undefined;
  const [first = "", ...groups] = text.split(thousands);
  if (!/^\d{1,3}$/.test(first) || !groups.every((group) => /^\d{3}$/.test(group))) {
    return undefined;
  }
  return first + groups.join("");
}

/**
 * One cell as a number: `null` = no value (empty or a missing-data mark),
 * `undefined` = not a number this column can hold.
 */
export function parseNumber(raw: string, mark: DecimalMark): number | null | undefined {
  if (isMissing(raw)) return null;
  let cell = bare(raw);
  const sign = /^[+-]/.exec(cell)?.[0] ?? "";
  cell = cell.slice(sign.length);
  // An exponent only in the dot notation programs write ("1.2e-05").
  const exponent = mark === "." ? (/[eE][+-]?\d+$/.exec(cell)?.[0] ?? "") : "";
  cell = cell.slice(0, cell.length - exponent.length);
  const [whole = "", fraction, ...more] = cell.split(mark);
  if (more.length || (fraction !== undefined && !/^\d+$/.test(fraction))) return undefined;
  const digits = wholePart(whole, mark === "." ? "," : ".");
  if (digits === undefined || !(digits || fraction)) return undefined;
  const value = Number(`${sign}${digits || "0"}${fraction ? `.${fraction}` : ""}${exponent}`);
  return Number.isFinite(value) ? value : undefined;
}

/** A year cell: an integer within the range the database accepts. */
export function parseYear(raw: string): number | null | undefined {
  if (isMissing(raw)) return null;
  const cell = raw.trim().replace(/\.0+$/, "");
  if (!/^\d{4}$/.test(cell)) return undefined;
  const year = Number(cell);
  return year >= IMPORT_LIMITS.yearMin && year <= IMPORT_LIMITS.yearMax ? year : undefined;
}

/** A year in a column heading: "2022", World Bank DataBank's "2022 [YR2022]". */
export function yearInHeading(heading: string): number | null {
  const found = /(?:^|\D)(1[89]\d\d|20\d\d|2100)(?:\D|$)/.exec(heading);
  return found ? (parseYear(found[1] ?? "") ?? null) : null;
}

/**
 * A categorical layer's value: the category code ("3") or its label
 * ("Electoral democracy", without case and accents). Without a code list any
 * whole number goes.
 */
export function parseCategory(
  raw: string,
  categories: readonly Category[],
): number | null | undefined {
  if (isMissing(raw)) return null;
  const number = parseNumber(raw, ".");
  if (number !== null && number !== undefined && Number.isInteger(number)) {
    if (!categories.length || categories.some((category) => category.value === number)) {
      return number;
    }
  }
  const key = normaliseName(raw);
  return categories.find((category) => normaliseName(category.label) === key)?.value;
}

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

export interface Mapping {
  country: number;
  value: number;
  /** -1 = none */
  year: number;
  /** -1 = none */
  note: number;
  decimal: "auto" | DecimalMark;
  /** Year for rows without one (no year column, or an empty year cell). */
  defaultYear: number | null;
}

const column = (table: Table, index: number) => table.rows.map((row) => row[index] ?? "");

const YEAR_HEADING = /^(year|years|yr|time|period|date|rok|jahr|annee|ano)$/;
const NOTE_HEADING =
  /\b(note|notes|comment|comments|footnote|footnotes|remark|remarks|flag|flags)\b/;

/**
 * The columns to start from: the country column matches the most countries
 * (a code column wins a near tie — codes are unambiguous); the value column
 * holds the most numbers (or categories), and among the nearly full ones the
 * rightmost, which in a wide World Bank file is the newest year; year and
 * note columns are recognised by their heading.
 */
export function guessMapping(
  table: Table,
  match: (cell: string) => CountryMatch,
  categories: readonly Category[] | null,
): Mapping {
  const columns = table.header.map((_, index) => column(table, index));

  const countryScores = columns.map((cells) => {
    let codes = 0;
    let names = 0;
    for (const cell of cells) {
      const found = match(cell);
      if (found.kind === "country") {
        if (found.by === "code") codes += 1;
        else names += 1;
      }
    }
    return { total: codes + names, codes };
  });
  const most = Math.max(0, ...countryScores.map((score) => score.total));
  let country = -1;
  countryScores.forEach((score, index) => {
    if (!score.total || score.total < most * 0.95) return;
    const current = countryScores[country];
    if (!current || (score.codes > score.total / 2 && current.codes <= current.total / 2)) {
      country = index;
    }
  });

  // A "Year" column whose cells are nearly all years (a stray bad cell becomes a row error).
  const year = table.header.findIndex((heading, index) => {
    if (index === country || !YEAR_HEADING.test(normaliseName(heading))) return false;
    const cells = (columns[index] ?? []).filter((cell) => cell.trim() !== "");
    const years = cells.filter((cell) => parseYear(cell) !== undefined).length;
    return years > 0 && years >= cells.length * 0.8;
  });
  const note = table.header.findIndex(
    (heading, index) => index !== country && NOTE_HEADING.test(normaliseName(heading)),
  );

  const valueScores = columns.map((cells, index) => {
    if (index === country || index === year || index === note) return 0;
    if (categories) {
      return cells.filter((cell) => {
        const value = parseCategory(cell, categories);
        return value !== null && value !== undefined;
      }).length;
    }
    const mark = detectDecimalMark(cells);
    return cells.filter((cell) => {
      const value = parseNumber(cell, mark);
      return value !== null && value !== undefined;
    }).length;
  });
  const fullest = Math.max(0, ...valueScores);
  let value = -1;
  valueScores.forEach((score, index) => {
    if (score > 0 && score >= fullest * 0.9) value = index;
  });

  return {
    country,
    value,
    year,
    note,
    decimal: "auto",
    defaultYear: value >= 0 ? yearInHeading(table.header[value] ?? "") : null,
  };
}

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

/** What happens to one row of the file (or one current value) on import. */
export type RowStatus = "add" | "change" | "same" | "remove" | "skip" | "error";

interface PreviewLine {
  /** Spreadsheet row of the record (null for a current value the file lacks). */
  row: number | null;
  cell: string;
  iso3: string | null;
  value: number | null;
  year: number | null;
  note: string | null;
  status: RowStatus;
  message: string;
}

interface Unmatched {
  /** The cell as written (trimmed): the key of the editor's choice. */
  cell: string;
  rows: number[];
}

export interface Preview {
  /** One row per country, ready to send. */
  rows: ImportRow[];
  lines: PreviewLine[];
  unmatched: Unmatched[];
  counts: Record<RowStatus, number> & { aggregates: number; duplicates: number };
  decimal: DecimalMark;
}

export interface CurrentValue {
  country_iso3: string;
  value: number;
  year: number | null;
  note: string | null;
}

/** Choice for an unmatched name: an ISO3 code, or SKIP. */
export const SKIP = "skip";

const sameValue = (a: CurrentValue, b: ImportRow) =>
  Number(a.value) === b.value && a.year === b.year && (a.note ?? null) === b.note;

/**
 * Applies the mapping to every data row: matches the country (or the
 * editor's choice for an unmatched name), reads value, year and note, keeps
 * one row per country (the newest year, then the last row) and compares the
 * result with the current values. `replace` marks the countries the file
 * lacks as removed — what the database will do.
 */
export function buildPreview({
  table,
  mapping,
  match,
  choices,
  categories,
  current,
  replace,
}: {
  table: Table;
  mapping: Mapping;
  match: (cell: string) => CountryMatch;
  choices: Readonly<Record<string, string>>;
  categories: readonly Category[] | null;
  current: readonly CurrentValue[];
  replace: boolean;
}): Preview {
  const decimal =
    mapping.decimal === "auto" ? detectDecimalMark(column(table, mapping.value)) : mapping.decimal;
  const lines: PreviewLine[] = [];
  const unmatched = new Map<string, number[]>();
  const kept = new Map<string, PreviewLine>();
  let aggregates = 0;
  let duplicates = 0;

  table.rows.forEach((cells, index) => {
    const row = table.headerIndex + index + 2;
    const cell = (cells[mapping.country] ?? "").trim();
    const line: PreviewLine = {
      row,
      cell,
      iso3: null,
      value: null,
      year: null,
      note: null,
      status: "skip",
      message: "",
    };
    lines.push(line);

    const found = match(cell);
    if (!cell) {
      line.message = "No country in this row.";
      return;
    }
    if (found.kind === "aggregate") {
      aggregates += 1;
      line.message = "Group of countries (world, region or income group), skipped.";
      return;
    }
    let iso3 = found.kind === "country" ? found.iso3 : null;
    if (!iso3) {
      const choice = choices[cell];
      unmatched.set(cell, [...(unmatched.get(cell) ?? []), row]);
      if (!choice || choice === SKIP) {
        line.message = choice ? "Skipped by you." : "Country not recognised: choose one below.";
        return;
      }
      iso3 = choice;
    }
    line.iso3 = iso3;

    const rawValue = cells[mapping.value] ?? "";
    const value = categories ? parseCategory(rawValue, categories) : parseNumber(rawValue, decimal);
    if (value === undefined) {
      line.status = "error";
      line.message = categories
        ? `“${rawValue.trim()}” is not one of this layer's categories.`
        : `“${rawValue.trim()}” is not a number.`;
      return;
    }
    if (value === null) {
      line.message = "No value in this row.";
      return;
    }
    line.value = value;

    const rawYear = mapping.year >= 0 ? (cells[mapping.year] ?? "") : "";
    const year = parseYear(rawYear);
    if (year === undefined) {
      line.status = "error";
      line.message = `“${rawYear.trim()}” is not a year between ${IMPORT_LIMITS.yearMin} and ${IMPORT_LIMITS.yearMax}.`;
      return;
    }
    line.year = year ?? mapping.defaultYear;

    const note = mapping.note >= 0 ? (cells[mapping.note] ?? "").trim() : "";
    if (note.length > IMPORT_LIMITS.note) {
      line.status = "error";
      line.message = `The note is longer than ${IMPORT_LIMITS.note} characters.`;
      return;
    }
    line.note = note || null;

    // One value per country: the newest year wins, then the later row.
    const earlier = kept.get(iso3);
    if (earlier) {
      duplicates += 1;
      const newer = (line.year ?? -Infinity) >= (earlier.year ?? -Infinity);
      const [winner, loser] = newer ? [line, earlier] : [earlier, line];
      loser.status = "skip";
      loser.message = `Same country again in row ${winner.row}: the ${
        mapping.year >= 0 ? "newest year" : "last row"
      } is kept.`;
      kept.set(iso3, winner);
    } else {
      kept.set(iso3, line);
    }
  });

  const now = new Map(current.map((value) => [value.country_iso3, value]));
  const rows: ImportRow[] = [];
  for (const [iso3, line] of kept) {
    const row: ImportRow = {
      country_iso3: iso3,
      value: line.value ?? 0,
      year: line.year,
      note: line.note,
    };
    rows.push(row);
    const before = now.get(iso3);
    line.status = !before ? "add" : sameValue(before, row) ? "same" : "change";
    line.message = !before
      ? "New value."
      : line.status === "same"
        ? "Already the same — left as it is."
        : `Was ${Number(before.value)}${before.year ? ` (${before.year})` : ""}.`;
  }
  if (replace) {
    for (const value of current) {
      if (kept.has(value.country_iso3)) continue;
      lines.push({
        row: null,
        cell: "",
        iso3: value.country_iso3,
        value: Number(value.value),
        year: value.year,
        note: value.note,
        status: "remove",
        message: "Not in the file: the value will be removed.",
      });
    }
  }

  const counts = {
    add: 0,
    change: 0,
    same: 0,
    remove: 0,
    skip: 0,
    error: 0,
    aggregates,
    duplicates,
  };
  for (const line of lines) counts[line.status] += 1;
  return {
    rows,
    lines,
    unmatched: [...unmatched].map(([cell, rowsOf]) => ({ cell, rows: rowsOf })),
    counts,
    decimal,
  };
}
