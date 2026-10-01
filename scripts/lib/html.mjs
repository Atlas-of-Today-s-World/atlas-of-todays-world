/**
 * HTML → plain text for scripts (smoke test, link check, Webflow import).
 * Not meant for sanitising rendered output — use src/lib/security/sanitize.ts.
 */

const ENTITIES = {
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
    return ENTITIES[name.toLowerCase()] ?? match;
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

/**
 * Text without scripts, styles, comments and tags. Block ends (`</p>`, `<br>`)
 * optionally become newlines; entities are decoded only at the very end.
 */
export function htmlToText(html, { lineBreaks = false } = {}) {
  let text = String(html ?? "");
  text = untilStable(text, /<(script|style)\b[\s\S]*?<\/\1\s*>/gi, " ");
  text = untilStable(text, /<!--[\s\S]*?-->/g, "");
  if (lineBreaks) text = text.replace(/<br\s*\/?>|<\/(p|li|h[1-6]|div)\s*>/gi, "\n");
  text = untilStable(text, /<[^<>]*>/g, " ");
  // Drop stray "<" or ">" left from tags so decoding cannot assemble anything from them.
  text = text.replace(/[<>]/g, " ");
  return decodeEntities(text);
}
