/**
 * Markdown → HTML for the published skills (/skills/<name>): the subset skills
 * are written in — ATX headings, paragraphs, lists (nested, tight or loose),
 * fenced code, block quotes, tables, rules, inline code, bold, italic, links.
 * No dependency: a few hundred lines are cheaper than a parser with plugins.
 *
 * All text is HTML-escaped here and the page still passes the result through
 * the editorial sanitizer (`SafeHtml`), so a skill can never put markup or a
 * script on the site — at worst it renders oddly. Headings go one level down
 * (the page's own <h1> is the skill's title) and stop at <h4>, the deepest the
 * sanitizer keeps; each gets an id in the shape the sanitizer allows.
 */

export interface MarkdownOptions {
  /** Rewrites a link target (a skill's relative links → its files or GitHub). */
  link?: (href: string) => string;
  /** Heading ids already used on the page, shared by the documents rendered on it. */
  ids?: Set<string>;
}

interface Context {
  link: (href: string) => string;
  ids: Set<string>;
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const escapeHtml = (text: string) => text.replace(/[&<>"]/g, (char) => ESCAPES[char]!);

const leading = (line: string) => /^ */.exec(line)![0].length;
const isBlank = (line: string | undefined) => line === undefined || !line.trim();

// ---------------------------------------------------------------------------
// Inline
// ---------------------------------------------------------------------------

/**
 * Pieces already turned into HTML wait in `slots` behind a private-use
 * character pair, so the escaping and emphasis rules never touch them.
 */
const SLOT = /\uE000(\d+)\uE001/g;

function inline(text: string, ctx: Context): string {
  const slots: string[] = [];
  const keep = (html: string) => `\uE000${slots.push(html) - 1}\uE001`;

  // Code spans first: nothing inside them is Markdown.
  let rest = "";
  for (let i = 0; i < text.length;) {
    if (text[i] !== "`") {
      rest += text[i++];
      continue;
    }
    const run = /^`+/.exec(text.slice(i))![0];
    const close = text.indexOf(run, i + run.length);
    // A closing run must be exactly as long (not part of a longer one).
    if (close < 0 || text[close + run.length] === "`") {
      rest += run;
      i += run.length;
      continue;
    }
    const code = text.slice(i + run.length, close).replace(/\n/g, " ");
    const trimmed = /^ .* $/.test(code) && code.trim() ? code.slice(1, -1) : code;
    rest += keep(`<code>${escapeHtml(trimmed)}</code>`);
    i = close + run.length;
  }

  const html = escapeHtml(
    rest
      // Hard line break: two spaces or a backslash at the end of a line.
      .replace(/(?: {2,}|\\)\n/g, () => keep("<br>"))
      // Backslash escapes.
      .replace(/\\([\\`*_{}[\]()#+\-.!|>~<])/g, (_match, char: string) => keep(escapeHtml(char)))
      // <https://…> autolinks.
      .replace(/<(https?:\/\/[^\s<>]+|mailto:[^\s<>]+)>/g, (_match, href: string) =>
        keep(`<a href="${escapeHtml(ctx.link(href))}">${escapeHtml(href)}</a>`),
      )
      // [text](target "title") and ![alt](src) — the text stays Markdown, the tags are kept
      // aside. A title (anything after the target) is dropped.
      .replace(
        /!?\[([^\]]*)\]\(\s*<?([^\s)>]*)>?[^)]*\)/g,
        (_match, label: string, href: string) =>
          `${keep(`<a href="${escapeHtml(ctx.link(href))}">`)}${label || href}${keep("</a>")}`,
      ),
  );

  return html
    .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^\w])__(?=\S)([\s\S]*?\S)__(?!\w)/g, "$1<strong>$2</strong>")
    .replace(/\*(?=[^\s*])([^*]*?[^\s*])\*/g, "<em>$1</em>")
    .replace(/(^|[^\w])_(?=[^\s_])([^_]*?[^\s_])_(?!\w)/g, "$1<em>$2</em>")
    .replace(SLOT, (_match, index: string) => slots[Number(index)] ?? "");
}

// ---------------------------------------------------------------------------
// Headings
// ---------------------------------------------------------------------------

/** Plain text of a heading, for its id. */
const plain = (text: string) => text.replace(/\]\([^)]*\)/g, "").replace(/[`*_[\]]/g, "");

/** `My heading` → `my-heading`: lowercase ASCII, a letter first, ≤ 63 characters, unique on the page. */
function headingId(text: string, ids: Set<string>): string {
  const slug = plain(text)
    .normalize("NFD")
    .replace(/\p{M}/gu, "") // accents split off by NFD (č → c)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const base = (/^[a-z]/.test(slug) ? slug : `h-${slug}`).slice(0, 56).replace(/-+$/, "");
  let id = base;
  for (let n = 2; ids.has(id); n++) id = `${base}-${n}`;
  ids.add(id);
  return id;
}

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
// Lookaheads instead of optional groups: no nested quantifiers (security/detect-unsafe-regex).
const HEADING = /^ {0,3}(#{1,6})(?=[ \t]|$)(.*)$/;
const QUOTE = /^ {0,3}> ?(.*)$/;
/** A list item: indent, marker, then its text after the spaces. */
const ITEM = /^( *)([-*+]|\d{1,9}[.)])(?=[ \t]|$)[ \t]*(.*)$/;

/** `---`, `***`, `___` (spaces between allowed): a thematic break. */
function isRule(line: string): boolean {
  const marks = line.replace(/[ \t]/g, "");
  return leading(line) < 4 && marks.length >= 3 && /^(?:-+|\*+|_+)$/.test(marks);
}

/** Cells of a table row (`| a | b |`); `\|` and pipes inside code spans don't split. */
function cells(line: string): string[] {
  const row = line
    .trim()
    .replace(/^\|/, "")
    .replace(/(?<!\\)\|$/, "");
  const out: string[] = [];
  let current = "";
  let code = false;
  for (let i = 0; i < row.length; i++) {
    const char = row[i]!;
    if (char === "\\" && row[i + 1] === "|") {
      current += "|";
      i++;
    } else if (char === "|" && !code) {
      out.push(current.trim());
      current = "";
    } else {
      if (char === "`") code = !code;
      current += char;
    }
  }
  out.push(current.trim());
  return out;
}

const isTableSeparator = (line: string | undefined) =>
  line !== undefined && line.includes("-") && cells(line).every((cell) => /^:?-+:?$/.test(cell));

const isTableStart = (lines: string[], i: number) =>
  lines[i]!.includes("|") && isTableSeparator(lines[i + 1]);

/** Does this line start a block other than a paragraph (so it ends a paragraph)? */
const startsBlock = (lines: string[], i: number) => {
  const line = lines[i]!;
  return (
    FENCE.test(line) ||
    HEADING.test(line) ||
    isRule(line) ||
    QUOTE.test(line) ||
    (ITEM.test(line) && leading(line) < 4) ||
    isTableStart(lines, i)
  );
};

function table(lines: string[], start: number, ctx: Context): { html: string; next: number } {
  const align = cells(lines[start + 1]!).map((cell) =>
    cell.startsWith(":") && cell.endsWith(":")
      ? "center"
      : cell.endsWith(":")
        ? "right"
        : cell.startsWith(":")
          ? "left"
          : "",
  );
  const row = (line: string, tag: "th" | "td") =>
    `<tr>${align
      .map((_, index) => `<${tag}>${inline(cells(line)[index] ?? "", ctx)}</${tag}>`)
      .join("")}</tr>`;
  let i = start + 2;
  const body: string[] = [];
  while (i < lines.length && !isBlank(lines[i]) && lines[i]!.includes("|")) {
    body.push(row(lines[i]!, "td"));
    i++;
  }
  const html = `<table><thead>${row(lines[start]!, "th")}</thead>${
    body.length ? `<tbody>${body.join("")}</tbody>` : ""
  }</table>`;
  return { html, next: i };
}

interface ListItem {
  lines: string[];
}

function list(lines: string[], start: number, ctx: Context): { html: string; next: number } {
  const first = ITEM.exec(lines[start]!)!;
  const indent = first[1]!.length;
  const ordered = /\d/.test(first[2]!);
  const sameList = (match: RegExpExecArray | null) =>
    match !== null &&
    leading(match[0]) >= indent &&
    leading(match[0]) < indent + 2 &&
    /\d/.test(match[2]!) === ordered;

  const items: ListItem[] = [];
  let loose = false;
  let i = start;
  while (i < lines.length) {
    const match = ITEM.exec(lines[i]!);
    if (!sameList(match)) break;
    // Content starts after the marker and its space(s).
    const content = match![0].length - (match![3] ?? "").length;
    const item: ListItem = { lines: [match![3] ?? ""] };
    items.push(item);
    i++;
    while (i < lines.length) {
      const line = lines[i]!;
      if (isBlank(line)) {
        // A blank line inside the list: it goes on if the next line is indented or a sibling.
        let next = i + 1;
        while (next < lines.length && isBlank(lines[next])) next++;
        const following = lines[next];
        if (following === undefined) break;
        if (leading(following) > indent && !sameList(ITEM.exec(following))) {
          loose = true;
          item.lines.push("");
          i = next;
          continue;
        }
        if (sameList(ITEM.exec(following))) loose = true;
        i = next;
        break;
      }
      if (sameList(ITEM.exec(line))) break;
      if (leading(line) > indent) {
        item.lines.push(line.slice(Math.min(leading(line), content)));
        i++;
        continue;
      }
      // Lazy continuation of the item's paragraph.
      if (!isBlank(item.lines.at(-1)) && !startsBlock(lines, i)) {
        item.lines.push(line.trim());
        i++;
        continue;
      }
      break;
    }
  }
  const tag = ordered ? "ol" : "ul";
  const body = items.map((item) => `<li>${blocks(item.lines, ctx, !loose)}</li>`).join("");
  return { html: `<${tag}>${body}</${tag}>`, next: i };
}

/** Renders block-level Markdown; `tight` list items get their text without <p>. */
function blocks(lines: string[], ctx: Context, tight = false): string {
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (isBlank(line)) {
      i++;
      continue;
    }

    const fence = FENCE.exec(line);
    if (fence) {
      const marker = fence[1]!;
      const indent = leading(line);
      const code: string[] = [];
      i++;
      while (i < lines.length) {
        const closing = lines[i]!.trim();
        if (
          leading(lines[i]!) < 4 &&
          closing.length >= marker.length &&
          closing === marker[0]!.repeat(closing.length)
        ) {
          break;
        }
        code.push(lines[i]!.slice(Math.min(leading(lines[i]!), indent)));
        i++;
      }
      i++; // the closing fence
      out.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      const text = (heading[2] ?? "").replace(/[ \t]+#+[ \t]*$/, "").trim();
      const level = Math.min(heading[1]!.length + 1, 4);
      out.push(`<h${level} id="${headingId(text, ctx.ids)}">${inline(text, ctx)}</h${level}>`);
      i++;
      continue;
    }

    if (isRule(line)) {
      out.push("<hr>");
      i++;
      continue;
    }

    if (QUOTE.test(line)) {
      const quoted: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i]!)) quoted.push(QUOTE.exec(lines[i++]!)![1]!);
      out.push(`<blockquote>${blocks(quoted, ctx)}</blockquote>`);
      continue;
    }

    if (isTableStart(lines, i)) {
      const result = table(lines, i, ctx);
      out.push(result.html);
      i = result.next;
      continue;
    }

    if (ITEM.test(line)) {
      const result = list(lines, i, ctx);
      out.push(result.html);
      i = result.next;
      continue;
    }

    // A paragraph: up to a blank line or the start of another block.
    // Trailing spaces stay until inline(): two of them are a line break.
    const paragraph = [line.trimStart()];
    i++;
    while (i < lines.length && !isBlank(lines[i]) && !startsBlock(lines, i)) {
      paragraph.push(lines[i]!.trimStart());
      i++;
    }
    const text = inline(paragraph.join("\n").replace(/[ \t]+$/, ""), ctx);
    out.push(tight ? text : `<p>${text}</p>`);
  }
  return out.join(tight ? "\n" : "");
}

export function markdownToHtml(markdown: string, options: MarkdownOptions = {}): string {
  const lines = markdown.replace(/\r\n?/g, "\n").replace(/\t/g, "    ").split("\n");
  return blocks(lines, { link: options.link ?? ((href) => href), ids: options.ids ?? new Set() });
}
