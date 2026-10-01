/**
 * HTML → prostý text pro skripty (smoke test, kontrola odkazů, import z Webflow).
 * Neslouží k sanitizaci pro vykreslení — na to je src/lib/security/sanitize.ts.
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
 * Entity jedním průchodem — `&amp;lt;` zůstane `&lt;`, ne `<` (dvojí
 * dekódování by z textu udělalo značku).
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

/** Opakuje náhradu, dokud se text mění (vnořené zbytky jako `<scr<script>ipt>`). */
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
 * Text bez skriptů, stylů, komentářů a značek. Konce bloků (`</p>`, `<br>`)
 * se volitelně změní na nový řádek; entity se dekódují až nakonec.
 */
export function htmlToText(html, { lineBreaks = false } = {}) {
  let text = String(html ?? "");
  text = untilStable(text, /<(script|style)\b[\s\S]*?<\/\1\s*>/gi, " ");
  text = untilStable(text, /<!--[\s\S]*?-->/g, "");
  if (lineBreaks) text = text.replace(/<br\s*\/?>|<\/(p|li|h[1-6]|div)\s*>/gi, "\n");
  text = untilStable(text, /<[^<>]*>/g, " ");
  // Osamocené „<" nebo „>" ze zbytků značek pryč, ať z nich dekódování nic nesloží.
  text = text.replace(/[<>]/g, " ");
  return decodeEntities(text);
}
