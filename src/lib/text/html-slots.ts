import { decodeEntities } from "./html";

/**
 * Sanitized HTML split around `{name}` placeholders, so that `SafeHtml` can put
 * a React element (a mail link, say) where the placeholder stands — without
 * building any HTML string itself.
 *
 * Input must already be sanitized (lib/security/sanitize.ts): balanced tags,
 * quoted attributes, `<` and `>` escaped in text and attribute values. The
 * output reuses only substrings of it. Elements without attributes that hold a
 * placeholder are rebuilt as React elements around their children; everything
 * else stays the sanitized HTML it was. A placeholder inside an attribute or
 * inside an element with attributes (a link) is left as plain text.
 */
export type HtmlPiece =
  /** An attribute-less element without a placeholder: `tag` with this inner HTML. */
  | { kind: "element"; tag: string; inner: string }
  /** Any other HTML without a placeholder (a link, an image), shown inline as it is. */
  | { kind: "inline"; html: string }
  /** Text (entities decoded — React escapes it again). */
  | { kind: "text"; text: string }
  | { kind: "slot"; name: string }
  /** An attribute-less element with a placeholder somewhere inside. */
  | { kind: "parent"; tag: string; children: HtmlPiece[] };

/** Tags the sanitizer allows without any attribute — safe to recreate by name. */
const PLAIN_TAGS = new Set([
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
  "sup",
  "sub",
]);
const VOID_TAGS = new Set(["br", "hr", "img"]);
/** Containers where whitespace between children isn't content (and React would warn). */
const NO_TEXT_TAGS = new Set(["ul", "ol", "table", "thead", "tbody", "tr"]);

interface TextNode {
  type: "text";
  raw: string;
}
interface ElementNode {
  type: "element";
  tag: string;
  plain: boolean;
  start: number;
  innerStart: number;
  innerEnd: number;
  end: number;
  children: Node[];
}
type Node = TextNode | ElementNode;

const TAG = /<(\/?)([a-z][a-z0-9]*)([^>]*)>/gi;

/** Builds the element tree of sanitized HTML, keeping each element's offsets. */
function parse(html: string): Node[] {
  const root: ElementNode = {
    type: "element",
    tag: "",
    plain: true,
    start: 0,
    innerStart: 0,
    innerEnd: html.length,
    end: html.length,
    children: [],
  };
  const stack: ElementNode[] = [root];
  const top = () => stack[stack.length - 1] as ElementNode;
  let last = 0;
  for (const match of html.matchAll(TAG)) {
    const index = match.index;
    if (index > last) top().children.push({ type: "text", raw: html.slice(last, index) });
    last = index + match[0].length;
    const tag = (match[2] as string).toLowerCase();
    const attributes = (match[3] as string).replace(/\/$/, "").trim();
    if (match[1]) {
      // Closing tag: close up to the matching element; a stray one is ignored.
      const at = stack.findLastIndex((node, i) => i > 0 && node.tag === tag);
      if (at < 0) continue;
      while (stack.length > at) {
        const node = stack.pop() as ElementNode;
        node.innerEnd = index;
        // The matching element ends after its closing tag; unclosed ones inside it, before.
        node.end = stack.length === at ? last : index;
      }
      continue;
    }
    const node: ElementNode = {
      type: "element",
      tag,
      plain: PLAIN_TAGS.has(tag) && attributes === "",
      start: index,
      innerStart: last,
      innerEnd: last,
      end: last,
      children: [],
    };
    top().children.push(node);
    if (!VOID_TAGS.has(tag)) stack.push(node);
  }
  if (last < html.length) top().children.push({ type: "text", raw: html.slice(last) });
  // Unclosed elements (not expected after sanitizing) end with the input.
  for (const node of stack.slice(1)) {
    node.innerEnd = html.length;
    node.end = html.length;
  }
  return root.children;
}

/** Any `{name}`; only the names asked for become slots, the rest stays text. */
const PLACEHOLDER = /\{(\w+)\}/g;

/** Positions of the wanted placeholders in a text node. */
function slotsIn(raw: string, names: ReadonlySet<string>) {
  return [...raw.matchAll(PLACEHOLDER)].filter((match) => names.has(match[1] as string));
}

function hasSlot(node: Node, names: ReadonlySet<string>): boolean {
  if (node.type === "text") return slotsIn(node.raw, names).length > 0;
  return node.plain && node.children.some((child) => hasSlot(child, names));
}

function pieces(
  html: string,
  nodes: Node[],
  names: ReadonlySet<string>,
  parent: string,
): HtmlPiece[] {
  const out: HtmlPiece[] = [];
  for (const node of nodes) {
    if (node.type === "text") {
      if (NO_TEXT_TAGS.has(parent) && !node.raw.trim()) continue;
      let last = 0;
      for (const match of slotsIn(node.raw, names)) {
        if (match.index > last) {
          out.push({ kind: "text", text: decodeEntities(node.raw.slice(last, match.index)) });
        }
        out.push({ kind: "slot", name: match[1] as string });
        last = match.index + match[0].length;
      }
      if (last < node.raw.length) {
        out.push({ kind: "text", text: decodeEntities(node.raw.slice(last)) });
      }
    } else if (!node.plain) {
      out.push({ kind: "inline", html: html.slice(node.start, node.end) });
    } else if (hasSlot(node, names)) {
      out.push({
        kind: "parent",
        tag: node.tag,
        children: pieces(html, node.children, names, node.tag),
      });
    } else {
      out.push({
        kind: "element",
        tag: node.tag,
        inner: html.slice(node.innerStart, node.innerEnd),
      });
    }
  }
  return out;
}

/** Sanitized HTML as pieces around the `{name}` placeholders of `names`. */
export function splitSlots(sanitizedHtml: string, names: readonly string[]): HtmlPiece[] {
  return pieces(sanitizedHtml, parse(sanitizedHtml), new Set(names), "");
}

/** Does the sanitized HTML contain any of the placeholders (in text, outside links)? */
export function hasSlots(sanitizedHtml: string, names: readonly string[]): boolean {
  const wanted = new Set(names);
  return wanted.size > 0 && parse(sanitizedHtml).some((node) => hasSlot(node, wanted));
}
