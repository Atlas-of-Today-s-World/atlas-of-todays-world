import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

/**
 * Jediná allowlist pro redakční HTML (ARCHITEKTURA 8.3). Používá se při uložení
 * i při vykreslení, takže i obsah, který se do DB dostal jinou cestou (PostgREST,
 * import), projde stejným sítem.
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
    // rel přepíše transformTags na "noopener noreferrer" — bez povolení by ho filtr zahodil.
    a: ["href", "title", "rel"],
    img: ["src", "alt", "title", "width", "height", "loading"],
  },
  allowedSchemes: ["https", "mailto"],
  allowedSchemesByTag: { img: ["https"] },
  allowProtocolRelative: false,
  transformTags: {
    // Odkazy ven nesmí dostat přístup k našemu oknu.
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
