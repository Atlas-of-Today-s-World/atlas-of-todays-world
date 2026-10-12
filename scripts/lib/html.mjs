/**
 * HTML → plain text for scripts (smoke test, link check, Webflow import).
 * Not meant for sanitising rendered output — use src/lib/security/sanitize.ts.
 *
 * Mirrors `decodeEntities` and `htmlToText` of src/lib/text/html.ts, which the
 * app uses: scripts run under plain Node and cannot import TypeScript.
 * tests/unit/html-text.test.ts checks that both give the same output — change
 * them together.
 */

const NAMED_ENTITIES = {
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
 * decoding would turn text into a tag).
 */
export function decodeEntities(value) {
  return String(value).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, name) => {
    if (name[0] === "#") {
      const code =
        name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : Number(name.slice(1));
      return Number.isFinite(code) && code > 0 && code < 0x110000
        ? String.fromCodePoint(code)
        : match;
    }
    return NAMED_ENTITIES[name.toLowerCase()] ?? match;
  });
}

/** Repeats the replacement while the text keeps changing (nested leftovers like `<scr<script>ipt>`). */
function untilStable(value, pattern, replacement) {
  let previous;
  let current = value;
  do {
    previous = current;
    current = current.replace(pattern, replacement);
  } while (current !== previous);
  return current;
}

const LINE_BREAK = /<br\b[^>]*>/gi;
const BLOCK_END = /<\/(?:p|li|h[1-6]|blockquote|figcaption|div)\s*>/gi;

/**
 * Text without scripts, styles, comments and tags; entities are decoded only at
 * the very end. Options as in src/lib/text/html.ts: `blockEnd` (what `</p>`,
 * `</li>`, `<br>`… become; unset = ordinary tags), `lineBreak` (`<br>` when it
 * differs), `tagGap` (other tags, default " "), `collapse` (one trimmed line).
 *
 * @param {unknown} html
 * @param {{ blockEnd?: string, lineBreak?: string, tagGap?: string, collapse?: boolean }} [options]
 * @returns {string}
 */
export function htmlToText(
  html,
  { blockEnd, lineBreak = blockEnd, tagGap = " ", collapse = false } = {},
) {
  let text = untilStable(String(html ?? ""), /<(script|style)\b[\s\S]*?<\/\1\s*>/gi, tagGap);
  text = untilStable(text, /<!--[\s\S]*?-->/g, "");
  if (lineBreak !== undefined) text = text.replace(LINE_BREAK, lineBreak);
  if (blockEnd !== undefined) text = text.replace(BLOCK_END, blockEnd);
  // Drop stray "<" or ">" left from tags so decoding cannot assemble anything from them.
  text = decodeEntities(untilStable(text, /<[^<>]*>/g, tagGap).replace(/[<>]/g, tagGap));
  return collapse ? text.replace(/\s+/g, " ").trim() : text;
}
