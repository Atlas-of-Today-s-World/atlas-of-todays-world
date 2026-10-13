import sanitizeHtml from "sanitize-html";
// Relative import: the Webflow import scripts load this module with plain Node, without path aliases.
import { isTrustedPhoto } from "../images";

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
