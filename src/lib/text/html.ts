/**
 * HTML → plain text: the one place that strips tags, decodes entities and
 * counts words (topic search, revision diff, Markdown for answer engines,
 * JSON-LD word counts).
 *
 * Not a sanitizer — what is rendered as HTML goes through
 * `lib/security/sanitize.ts`. The output here is plain text: it never contains
 * a tag, because entities are decoded only after every tag and stray angle
 * bracket is gone (decoding first could turn `&lt;b&gt;` into markup).
 *
 * `scripts/lib/html.mjs` mirrors `decodeEntities` and `htmlToText` for scripts
 * that run under plain Node (no TypeScript); `tests/unit/html-text.test.ts`
 * checks that both give the same output. Change them together.
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
};

/**
 * Entities in a single pass — `&amp;lt;` stays `&lt;`, not `<` (double
 * decoding would turn text into a tag). Unknown names and code points outside
 * Unicode stay as they are.
 */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, name: string) => {
    if (name.startsWith("#")) {
      const code =
        name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : Number(name.slice(1));
      return Number.isFinite(code) && code > 0 && code < 0x110000
        ? String.fromCodePoint(code)
        : match;
    }
    return NAMED_ENTITIES[name.toLowerCase()] ?? match;
  });
}

/** Repeats the replacement while the text keeps changing (nested leftovers like `<scr<b>ipt>`). */
function untilStable(text: string, pattern: RegExp, replacement: string): string {
  let previous: string;
  let current = text;
  do {
    previous = current;
    current = current.replace(pattern, replacement);
  } while (current !== previous);
  return current;
}

/**
 * Removes every tag, then any stray `<` or `>` left of broken markup, so the
 * result can never contain a tag. Entities are left encoded.
 */
export function stripTags(html: string, gap = ""): string {
  return untilStable(html, /<[^<>]*>/g, gap).replace(/[<>]/g, gap);
}

const LINE_BREAK = /<br\b[^>]*>/gi;
const BLOCK_END = /<\/(?:p|li|h[1-6]|blockquote|figcaption|div)\s*>/gi;

export interface HtmlToTextOptions {
  /**
   * What the end of a block (`</p>`, `</li>`, `</h2>`, `</blockquote>`…) and
   * `<br>` become, e.g. `"\n"` for one line per paragraph. Unset: they are
   * ordinary tags.
   */
  blockEnd?: string;
  /** What `<br>` becomes when it differs from `blockEnd`. */
  lineBreak?: string;
  /**
   * What every other tag (and a stray `<` or `>`) becomes. Default `" "`, so
   * tags never glue words together; `""` keeps inline markup inside a word
   * (`<b>W</b>ord` → `Word`).
   */
  tagGap?: string;
  /** Collapse whitespace runs to one space and trim (one line of text). */
  collapse?: boolean;
}

/**
 * Text without scripts, styles, comments and tags, with entities decoded at the
 * very end.
 */
export function htmlToText(
  html: string,
  { blockEnd, lineBreak = blockEnd, tagGap = " ", collapse = false }: HtmlToTextOptions = {},
): string {
  let text = untilStable(html, /<(script|style)\b[\s\S]*?<\/\1\s*>/gi, tagGap);
  text = untilStable(text, /<!--[\s\S]*?-->/g, "");
  if (lineBreak !== undefined) text = text.replace(LINE_BREAK, lineBreak);
  if (blockEnd !== undefined) text = text.replace(BLOCK_END, blockEnd);
  text = decodeEntities(stripTags(text, tagGap));
  return collapse ? text.replace(/\s+/g, " ").trim() : text;
}

/** Words of an HTML text (JSON-LD `wordCount`); every tag separates words. */
export function wordCount(html: string): number {
  return htmlToText(html).split(/\s+/).filter(Boolean).length;
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };

/**
 * Plain text → paragraphs of HTML (the opposite direction): a blank line
 * starts a paragraph, a single line break stays a `<br>`. Everything is
 * escaped, so the output holds no markup but `<p>` and `<br>` — for plain text
 * stored before a field became rich text (timeline events), so the rich text
 * editor and the page show it the same way.
 */
export function textToHtml(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map(
      (paragraph) =>
        `<p>${paragraph.replace(/[&<>"]/g, (char) => ESCAPES[char] ?? char).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
}
