import { xmlEscape } from "@/lib/seo/xml";
import { sanitizeRichHtml } from "@/lib/security/sanitize";

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
