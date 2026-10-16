/**
 * The YAML frontmatter of a SKILL.md, read without a YAML library: skills use
 * a tiny subset — `key: value` (plain, "double" or 'single' quoted), inline
 * lists `[a, b]`, a list of `- item` lines under `key:`, folded `>` / literal
 * `|` blocks and plain values continued on indented lines. Anything else (a
 * nested map such as `metadata:`) is skipped, never an error: a skill with odd
 * frontmatter still gets published, it just shows fewer facts.
 */

export type FrontmatterValue = string | string[];

export interface Frontmatter {
  data: Record<string, FrontmatterValue>;
  /** The Markdown after the closing `---`. */
  body: string;
}

// Lookaheads instead of optional groups: no nested quantifiers (security/detect-unsafe-regex).
const KEY = /^([A-Za-z0-9_-]+):(?=[ \t]|$)(.*)$/;
const ITEM = /^[ \t]+-(?=[ \t]|$)(.*)$/;
const indented = (line: string) => /^[ \t]/.test(line);

/** Index of the quote closing the one at 0 (`\"` escapes in "…", `''` in '…'), or -1. */
function closingQuote(value: string): number {
  const quote = value[0];
  for (let i = 1; i < value.length; i++) {
    if (quote === '"' && value[i] === "\\") i++;
    else if (quote === "'" && value[i] === "'" && value[i + 1] === "'") i++;
    else if (value[i] === quote) return i;
  }
  return -1;
}

/** A double-quoted value: the usual escapes; a single-quoted one: '' is a quote. */
function unquote(raw: string): string {
  const value = raw.trim();
  const end = value.startsWith('"') || value.startsWith("'") ? closingQuote(value) : -1;
  if (end > 0) {
    // Anything after the closing quote (a comment) is dropped.
    const inner = value.slice(1, end);
    return value.startsWith("'")
      ? inner.replace(/''/g, "'")
      : inner.replace(/\\(["\\/nt])/g, (_match, char: string) =>
          char === "n" ? "\n" : char === "t" ? "\t" : char,
        );
  }
  // A plain value ends where a comment starts (" #").
  return value.replace(/[ \t]+#.*$/, "");
}

/** `[a, "b, c", 'd']` → its items (commas inside quotes don't split). */
function inlineList(raw: string): string[] {
  const items: string[] = [];
  let current = "";
  let quote = "";
  for (const char of raw.trim().slice(1, -1)) {
    if (quote) {
      if (char === quote) quote = "";
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === ",") {
      items.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  items.push(current);
  return items.map(unquote).filter(Boolean);
}

/** `>` joins the block's lines with spaces (a blank line is a line break), `|` keeps them. */
function block(style: string, lines: string[]): string {
  const margin = Math.min(
    ...lines.filter((l) => l.trim()).map((l) => /^[ \t]*/.exec(l)![0].length),
  );
  const text = lines.map((line) => line.slice(margin).trimEnd());
  if (style.startsWith("|")) return text.join("\n").trim();
  return text
    .join("\n")
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\n/g, " "))
    .join("\n");
}

function parseLines(lines: string[]): Record<string, FrontmatterValue> {
  const data: Record<string, FrontmatterValue> = {};
  let i = 0;
  while (i < lines.length) {
    const match = KEY.exec(lines[i]!);
    i++;
    if (!match) continue; // a comment, a blank line or a line of something skipped
    const [, key, raw = ""] = match;
    // The indented lines that belong to this key.
    const nested: string[] = [];
    while (i < lines.length && (indented(lines[i]!) || !lines[i]!.trim())) nested.push(lines[i++]!);
    const value = raw.trim();
    if (/^[>|][+-]?$/.test(value)) {
      data[key!] = block(value, nested);
    } else if (value.startsWith("[") && value.endsWith("]")) {
      data[key!] = inlineList(value);
    } else if (value) {
      const more = nested.map((line) => line.trim()).filter(Boolean);
      data[key!] = unquote([value, ...more].join(" "));
    } else if (nested.some((line) => ITEM.test(line))) {
      data[key!] = nested.flatMap((line) => {
        const item = ITEM.exec(line);
        return item?.[1] ? [unquote(item[1])] : [];
      });
    }
    // `key:` with a nested map under it: not used by the site, skipped.
  }
  return data;
}

export function parseFrontmatter(source: string): Frontmatter {
  const text = source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const lines = text.split("\n");
  if (lines[0]?.trim() !== "---") return { data: {}, body: text };
  const end = lines.findIndex((line, index) => index > 0 && /^(---|\.\.\.)\s*$/.test(line));
  if (end < 0) return { data: {}, body: text };
  return {
    data: parseLines(lines.slice(1, end)),
    body: lines
      .slice(end + 1)
      .join("\n")
      .replace(/^\n+/, ""),
  };
}

/** A value as one string (a list joined by ", "); empty when missing. */
export const asText = (value: FrontmatterValue | undefined): string =>
  Array.isArray(value) ? value.join(", ") : (value ?? "").trim();

/** A value as a list: a YAML list as it is, a string split on commas. */
export const asList = (value: FrontmatterValue | undefined): string[] =>
  (Array.isArray(value) ? value : (value ?? "").split(","))
    .map((item) => item.trim())
    .filter(Boolean);
