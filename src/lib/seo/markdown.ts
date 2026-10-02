/**
 * Sanitized editorial HTML → Markdown, for llms.txt / llms-full.txt and the
 * `.md` versions of articles (what answer engines read most reliably).
 *
 * Input is always the output of `sanitizeRichHtml` (a small, known tag set),
 * so a few ordered rules are enough; anything else is reduced to its text.
 * The result is served as text/markdown, never rendered as HTML by the Atlas.
 */

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** Entities in a single pass (`&amp;lt;` stays `&lt;`). */
function decode(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, name: string) => {
    if (name.startsWith("#")) {
      const code =
        name[1]?.toLowerCase() === "x" ? parseInt(name.slice(2), 16) : Number(name.slice(1));
      return Number.isFinite(code) && code > 0 && code < 0x110000
        ? String.fromCodePoint(code)
        : match;
    }
    return ENTITIES[name.toLowerCase()] ?? match;
  });
}

const ATTRIBUTES = { src: /\ssrc="([^"]*)"/i, alt: /\salt="([^"]*)"/i, href: /\shref="([^"]*)"/i };
const attr = (tag: string, name: keyof typeof ATTRIBUTES) => ATTRIBUTES[name].exec(tag)?.[1] ?? "";

/** Text of an inline fragment: links, emphasis, code, line breaks. */
function inline(html: string): string {
  const text = html
    .replace(/<br\s*\/?>/gi, "  \n")
    .replace(/<img\b[^>]*>/gi, (tag) => {
      const src = attr(tag, "src");
      return src ? `![${attr(tag, "alt")}](${src})` : "";
    })
    .replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (_match, attrs: string, text: string) => {
      const href = attr(` ${attrs}`, "href");
      const label = inline(text).trim();
      return href ? `[${label || href}](${href})` : label;
    })
    .replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, (_m, _t, text: string) => `**${text.trim()}**`)
    .replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, (_m, _t, text: string) => `_${text.trim()}_`)
    .replace(/<code>([\s\S]*?)<\/code>/gi, "`$1`")
    .replace(/<sup>([\s\S]*?)<\/sup>/gi, "^$1")
    .replace(/<sub>([\s\S]*?)<\/sub>/gi, "~$1");
  return stripTags(text);
}

/**
 * Drops the remaining tags. Input is sanitized HTML, where a literal "<" in text
 * is always `&lt;` — so a "<" or ">" left after removing tags belongs to broken
 * markup and goes too: the result can never contain a tag.
 */
function stripTags(html: string): string {
  // A character scan rather than a regex: nested leftovers like `<scr<b>ipt>` can't survive it.
  let out = "";
  let inTag = false;
  for (const char of html) {
    if (char === "<") inTag = true;
    else if (char === ">") inTag = false;
    else if (!inTag) out += char;
  }
  return out;
}

/** Table as a Markdown pipe table (first row is the header). */
function table(html: string): string {
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) =>
    [...(row[1] ?? "").matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((cell) =>
      inline(cell[1] ?? "")
        // Backslashes first, so text can't turn an escaped pipe back into a column break.
        .replace(/\\/g, "\\\\")
        .replace(/\|/g, "\\|")
        .replace(/\s+/g, " ")
        .trim(),
    ),
  );
  if (!rows.length) return "";
  const width = Math.max(...rows.map((row) => row.length));
  const line = (cells: string[]) =>
    `| ${Array.from({ length: width }, (_, i) => cells[i] ?? "").join(" | ")} |`;
  return [line(rows[0] ?? []), line(Array(width).fill("---")), ...rows.slice(1).map(line)].join(
    "\n",
  );
}

function list(html: string, ordered: boolean): string {
  const items = [...html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)];
  return items
    .map((item, index) => {
      const text = inline(item[1] ?? "")
        .replace(/\s+/g, " ")
        .trim();
      return `${ordered ? `${index + 1}.` : "-"} ${text}`;
    })
    .join("\n");
}

/** Converts sanitized HTML to Markdown blocks separated by blank lines. */
export function htmlToMarkdown(html: string): string {
  const blocks: string[] = [];
  const keep = (text: string) => `\n\n\u0000${blocks.push(text) - 1}\u0000\n\n`;

  const md = html
    .replace(/\r\n?/g, "\n")
    .replace(/<pre>([\s\S]*?)<\/pre>/gi, (_m, code: string) =>
      keep(`\`\`\`\n${decode(stripTags(code)).trim()}\n\`\`\``),
    )
    .replace(/<table\b[^>]*>([\s\S]*?)<\/table>/gi, (_m, body: string) => keep(decode(table(body))))
    .replace(/<ol\b[^>]*>([\s\S]*?)<\/ol>/gi, (_m, body: string) => keep(decode(list(body, true))))
    .replace(/<ul\b[^>]*>([\s\S]*?)<\/ul>/gi, (_m, body: string) => keep(decode(list(body, false))))
    .replace(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi, (_m, body: string) =>
      keep(
        decode(inline(body.replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")))
          .trim()
          .split("\n")
          .map((line) => `> ${line}`.trimEnd())
          .join("\n"),
      ),
    )
    .replace(/<h([2-4])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, level: string, text: string) =>
      keep(`${"#".repeat(Number(level))} ${decode(inline(text)).replace(/\s+/g, " ").trim()}`),
    )
    .replace(/<hr\s*\/?>/gi, () => keep("---"))
    .replace(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/gi, (_m, text: string) =>
      keep(`_${decode(inline(text)).trim()}_`),
    )
    .replace(/<\/?(p|figure|div)\b[^>]*>/gi, "\n\n");

  return decode(inline(md))
    .split(/\n{2,}/)
    .map((block) =>
      block.replace(/[ \t]*\n[ \t]*/g, (m) => (m.includes("  ") ? "  \n" : " ")).trim(),
    )
    .map((block) =>
      block.replace(/\u0000(\d+)\u0000/g, (_m, index: string) => blocks[Number(index)] ?? ""),
    )
    .filter(Boolean)
    .join("\n\n");
}
