import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

/**
 * The single allowlist for editorial HTML (ARCHITEKTURA 8.3). Used both on save
 * and on render, so even content that reached the DB another way (PostgREST,
 * import) goes through the same filter.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "h2",
    "h3",
    "h4",
    "p",
    "blockquote",
    "ul",
    "ol",
    "li",
    "strong",
    "em",
    "a",
    "code",
    "pre",
    "hr",
    "br",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "figure",
    "figcaption",
    "img",
    "sup",
    "sub",
  ],
  allowedAttributes: {
    // transformTags rewrites rel to "noopener noreferrer" — unless allowed, the filter would drop it.
    a: ["href", "title", "rel"],
    img: ["src", "alt", "title", "width", "height", "loading"],
  },
  allowedSchemes: ["https", "mailto"],
  allowedSchemesByTag: { img: ["https"] },
  allowProtocolRelative: false,
  transformTags: {
    // Outbound links must not get access to our window.
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
    img: sanitizeHtml.simpleTransform("img", { loading: "lazy" }),
  },
};

export function sanitizeRichHtml(html: string): string {
  return sanitizeHtml(html, OPTIONS);
}

export function markdownToSafeHtml(markdown: string): string {
  return sanitizeRichHtml(marked.parse(markdown, { async: false }) as string);
}
