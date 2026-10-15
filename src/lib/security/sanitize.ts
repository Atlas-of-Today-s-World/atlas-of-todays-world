import sanitizeHtml from "sanitize-html";
// Relative import: the Webflow import scripts load this module with plain Node, without path aliases.
import { isTrustedPhoto } from "../images";
import { INLINE_STYLE_CLASSES } from "../text/inline-styles";

/**
 * The single allowlist for editorial HTML (ARCHITEKTURA 8.3). Used both on save
 * and on render, so even content that reached the DB another way (PostgREST,
 * import) goes through the same filter.
 */
/**
 * Anchor of a heading (`<h2 id="data">`, linked as /about#data): lowercase
 * words joined by hyphens, starting with a letter — so it can't name a
 * browser global or an id the app uses with a leading underscore/capital.
 */
const HEADING_ID = /^[a-z][a-z0-9-]{0,62}$/;

/** A heading keeps its `id` only in the shape above; any other id is dropped. */
const headingAnchor: sanitizeHtml.Transformer = (tagName, attribs) => {
  const { id, ...rest } = attribs;
  return { tagName, attribs: id && HEADING_ID.test(id) ? { ...rest, id } : rest };
};

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
    h2: ["id"],
    h3: ["id"],
    h4: ["id"],
  },
  allowedSchemes: ["https", "mailto"],
  allowedSchemesByTag: { img: ["https"] },
  allowProtocolRelative: false,
  transformTags: {
    // Outbound links must not get access to our window.
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
    img: sanitizeHtml.simpleTransform("img", { loading: "lazy" }),
    h2: headingAnchor,
    h3: headingAnchor,
    h4: headingAnchor,
  },
  // Pictures only from our own photos and the photo origins the site already
  // trusts (lib/images): one from anywhere else would be a tracking pixel in every
  // reader's browser. The whole <img> goes, not just its src. `srcset` isn't
  // allowed at all, so it can't bring in another host either.
  exclusiveFilter: (frame) => frame.tag === "img" && !isTrustedPhoto(frame.attribs.src ?? ""),
};

export function sanitizeRichHtml(html: string): string {
  return sanitizeHtml(html, OPTIONS);
}

/**
 * Short rich text of a map point's popup: paragraphs, bold, italic, links and
 * lists — no headings, images or tables. Colour and size come only as one of
 * the fixed `<span>` classes (lib/text/inline-styles); a `style` attribute
 * never survives, so the stored HTML carries no CSS at all. Links open in a
 * new tab without access to our window.
 */
const POPUP_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "strong", "em", "a", "ul", "ol", "li", "span"],
  allowedAttributes: { a: ["href", "rel", "target"], span: ["class"] },
  allowedClasses: { span: [...INLINE_STYLE_CLASSES] },
  allowedSchemes: ["https", "mailto"],
  allowProtocolRelative: false,
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
  },
  // The editor leaves an empty paragraph after a list; in a small popup it is a gap.
  exclusiveFilter: (frame) => frame.tag === "p" && !frame.text.trim(),
};

export function sanitizePopupHtml(html: string): string {
  return sanitizeHtml(html, POPUP_OPTIONS);
}
