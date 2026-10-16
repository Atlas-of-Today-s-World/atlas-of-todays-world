/**
 * Reading CSV in the browser (the data-layer import) — no Zod, no server code,
 * so client components may import it. Writing CSV is components/data-table/csv.
 *
 * RFC 4180: fields in double quotes may hold the delimiter, line breaks and
 * doubled quotes (`""` → `"`); lines end with CRLF or LF; a UTF-8 BOM is
 * dropped. Unlike the RFC it also reads `;` and tab separated files, which
 * spreadsheets in many locales (Czech Excel among them) write by default.
 *
 * (scripts/webflow/core.mjs keeps its own comma-only reader: the import
 * scripts are plain Node .mjs, loaded before anything can import TypeScript.)
 */

export const CSV_DELIMITERS = [",", ";", "\t"] as const;
export type CsvDelimiter = (typeof CSV_DELIMITERS)[number];

/** How many lines the delimiter guess looks at. */
const SAMPLE_LINES = 20;

const withoutBom = (text: string) => (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);

/** Delimiters on each of the first lines, counted outside quoted fields. */
function delimiterCounts(text: string): Record<CsvDelimiter, number>[] {
  const lines: Record<CsvDelimiter, number>[] = [];
  let line = { ",": 0, ";": 0, "\t": 0 };
  let quoted = false;
  let content = false;
  for (let i = 0; i < text.length && lines.length < SAMPLE_LINES; i += 1) {
    const char = text[i];
    if (char === '"') {
      quoted = !quoted; // a doubled quote toggles twice
      content = true;
    } else if (!quoted && (char === "\n" || char === "\r")) {
      if (content) lines.push(line);
      line = { ",": 0, ";": 0, "\t": 0 };
      content = false;
    } else {
      if (!quoted && (char === "," || char === ";" || char === "\t")) line[char] += 1;
      if (char !== " ") content = true;
    }
  }
  if (content && lines.length < SAMPLE_LINES) lines.push(line);
  return lines;
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)] ?? 0;
};

/**
 * The delimiter most lines use (the median count per line, so a few title
 * lines above the header don't decide). On a tie tab wins, then `;`: a file
 * separated by `;` usually writes decimal commas ("Czechia;12,5").
 */
export function detectDelimiter(text: string): CsvDelimiter {
  const lines = delimiterCounts(withoutBom(text));
  let best: CsvDelimiter = ",";
  let bestScore = 0;
  for (const delimiter of ["\t", ";", ","] as const) {
    const score = median(lines.map((line) => line[delimiter]));
    if (score > bestScore) {
      best = delimiter;
      bestScore = score;
    }
  }
  return best;
}

/**
 * All records of the file as arrays of cells (no header handling, blank lines
 * dropped). Cells are returned as written, untrimmed.
 */
export function parseCsv(
  text: string,
  delimiter: CsvDelimiter = detectDelimiter(text),
): string[][] {
  const source = withoutBom(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const endRow = () => {
    row.push(field);
    if (row.some((cell) => cell.trim() !== "")) rows.push(row);
    row = [];
    field = "";
  };
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"' && field.trim() === "") {
      // A quote opens a quoted field only at its start (spaces before it are dropped).
      field = "";
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i += 1;
      endRow();
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length) endRow();
  return rows;
}
