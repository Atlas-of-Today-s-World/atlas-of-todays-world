import { xmlEscape } from "@/lib/seo/xml";
import { sanitizeRichHtml } from "@/lib/security/sanitize";
import { htmlToText } from "@/lib/text/html";

/**
 * Filling the placeholders of a site page body (pure, unit-tested).
 *
 * Works on sanitized HTML only: there `<` and `>` appear solely as tag
 * delimiters (text and attribute values are escaped), so splitting on tags is
 * exact. Placeholders are replaced in text, never inside a tag or attribute,
 * and the replacement is built from escaped values — the result goes through
 * the sanitizer again when it is rendered (`SafeHtml`).
 */

const TAGS = /(<[^>]*>)/;
const OPEN_OR_CLOSE = /<(\/?)([a-z0-9]+)[^>]*>/gi;
const VOID = new Set(["br", "hr", "img"]);

/** Replaces `token` in the text of `html` (not in tags or attribute values). */
export function replaceInText(html: string, token: string, replacement: string): string {
  return html
    .split(TAGS)
    .map((part) => (part.startsWith("<") ? part : part.split(token).join(replacement)))
    .join("");
}

/** A link as HTML, from trusted values (escaped). */
export const linkHtml = (href: string, label: string) =>
  `<a href="${xmlEscape(href)}">${xmlEscape(label)}</a>`;

/** Inline placeholders: each token → the HTML to put in its place (already escaped). */
export function fillInline(html: string, values: Record<string, string>): string {
  let out = sanitizeRichHtml(html);
  for (const [token, replacement] of Object.entries(values)) {
    out = replaceInText(out, token, replacement);
  }
  return out;
}

/** How deep in the element tree position `end` of `html` is (0 = top level). */
function depthAt(html: string, end: number): number {
  let depth = 0;
  for (const match of html.slice(0, end).matchAll(OPEN_OR_CLOSE)) {
    if (VOID.has((match[2] ?? "").toLowerCase())) continue;
    depth += match[1] ? -1 : 1;
  }
  return depth;
}

/**
 * Splits `html` at a block placeholder — a top-level paragraph holding only
 * `token` — into the HTML before and after it, for a component rendered by
 * code in between. Without such a paragraph `after` is null (the component
 * goes below the whole body). A token left anywhere else is removed, so the
 * braces never show.
 */
export function splitAtBlock(
  html: string,
  token: string,
): { before: string; after: string | null } {
  const marker = `<p>${token}</p>`;
  const at = html.indexOf(marker);
  if (at >= 0 && depthAt(html, at) === 0) {
    return {
      before: replaceInText(html.slice(0, at), token, ""),
      after: replaceInText(html.slice(at + marker.length), token, ""),
    };
  }
  return { before: replaceInText(html, token, ""), after: null };
}

/** One milestone of a timeline section: "2015–2019: Refugee crisis" and the HTML below it. */
export interface Milestone {
  /** Text before the heading's first colon; empty when the heading has none. */
  date: string;
  title: string;
  /** Everything up to the next heading. */
  html: string;
}

const H2_OR_H3 = /<(h2|h3)\b[^>]*>/gi;

/**
 * Splits `html` at the section with heading `<h2 id="sectionId">` whose
 * `<h3>` headings are milestones (About → Our story): the HTML before the
 * first `<h3>` (the section heading and its intro stay there), the milestones
 * and the HTML from the next `<h2>` on. Null when there is no such section
 * or it has no `<h3>`. Only top-level headings count.
 */
export function splitTimeline(
  html: string,
  sectionId: string,
): { before: string; milestones: Milestone[]; after: string } | null {
  const headings = [...html.matchAll(H2_OR_H3)]
    .filter((match) => depthAt(html, match.index) === 0)
    .map((match) => ({
      tag: (match[1] ?? "").toLowerCase(),
      at: match.index,
      isSection: match[0].includes(` id="${sectionId}"`),
    }));
  const start = headings.findIndex((heading) => heading.tag === "h2" && heading.isSection);
  if (start < 0) return null;
  const rest = headings.slice(start + 1);
  const next = rest.findIndex((heading) => heading.tag === "h2");
  const items = next < 0 ? rest : rest.slice(0, next);
  if (!items.length) return null;
  const end = next < 0 ? html.length : rest[next]!.at;

  const milestones = items.map((item, index) => {
    const until = items[index + 1]?.at ?? end;
    const block = html.slice(item.at, until);
    const close = block.search(/<\/h3>/i);
    const heading = htmlToText(close < 0 ? "" : block.slice(0, close), { collapse: true });
    const colon = heading.indexOf(":");
    const title = colon < 0 ? heading : heading.slice(colon + 1).trim();
    return {
      date: colon < 0 ? "" : heading.slice(0, colon).trim(),
      title: title.charAt(0).toUpperCase() + title.slice(1),
      html: close < 0 ? block : block.slice(close + "</h3>".length),
    };
  });
  return { before: html.slice(0, items[0]!.at), milestones, after: html.slice(end) };
}
