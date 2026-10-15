import { safeUrl } from "@/lib/security/urls";
import { inlineStyleOf } from "@/lib/text/inline-styles";

/**
 * Popup rich text → a small tree the renderer draws as React elements, so no
 * HTML string is ever injected into the page (ARCHITEKTURA 5.1). The HTML was
 * sanitized on save (`sanitizePopupHtml` via parseMapSpec); this second,
 * stricter pass keeps only the same tags and turns everything else into text.
 */

const BLOCK_TAGS = { P: "p", UL: "ul", OL: "ol", LI: "li" } as const;
const INLINE_TAGS = { STRONG: "strong", B: "strong", EM: "em", I: "em", SPAN: "span" } as const;
/** Dropped with their content (anything else unknown is unwrapped to its text). */
const DROPPED = new Set([
  "SCRIPT",
  "STYLE",
  "TEMPLATE",
  "NOSCRIPT",
  "IFRAME",
  "OBJECT",
  "EMBED",
  "SVG",
  "MATH",
  "TITLE",
  "HEAD",
]);

type Tag =
  (typeof BLOCK_TAGS)[keyof typeof BLOCK_TAGS] | (typeof INLINE_TAGS)[keyof typeof INLINE_TAGS];

export type RichNode =
  | { kind: "text"; text: string }
  | { kind: "br" }
  | {
      kind: "element";
      tag: Tag;
      style?: { color?: string; fontSize?: string };
      children: RichNode[];
    }
  | { kind: "link"; href: string; children: RichNode[] };

/** The part of a DOM node this reads (a browser `Node`, or a test double). */
export interface DomLike {
  nodeType: number;
  nodeName: string;
  textContent: string | null;
  childNodes: ArrayLike<DomLike>;
  getAttribute?: (name: string) => string | null;
}

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

const tagOf = (name: string): Tag | undefined =>
  Object.hasOwn(BLOCK_TAGS, name)
    ? BLOCK_TAGS[name as keyof typeof BLOCK_TAGS]
    : Object.hasOwn(INLINE_TAGS, name)
      ? INLINE_TAGS[name as keyof typeof INLINE_TAGS]
      : undefined;

export function toRichNodes(nodes: ArrayLike<DomLike>): RichNode[] {
  return Array.from(nodes).flatMap((node): RichNode[] => {
    if (node.nodeType === TEXT_NODE) {
      return node.textContent ? [{ kind: "text", text: node.textContent }] : [];
    }
    if (node.nodeType !== ELEMENT_NODE) return [];
    const name = node.nodeName.toUpperCase();
    if (DROPPED.has(name)) return [];
    if (name === "BR") return [{ kind: "br" }];
    const children = toRichNodes(node.childNodes);
    if (name === "A") {
      const href = safeUrl(node.getAttribute?.("href"), { allowMailto: true });
      return href ? [{ kind: "link", href, children }] : children;
    }
    const tag = tagOf(name);
    if (!tag) return children;
    if (tag !== "span") return [{ kind: "element", tag, children }];
    const style = inlineStyleOf(node.getAttribute?.("class"));
    return style.color || style.fontSize ? [{ kind: "element", tag, style, children }] : children;
  });
}

/** Parses popup HTML in the browser (DOMParser runs no scripts and loads nothing). */
export function parsePopupHtml(html: string): RichNode[] {
  if (!html.trim()) return [];
  const doc = new DOMParser().parseFromString(html, "text/html");
  return toRichNodes(doc.body.childNodes);
}
