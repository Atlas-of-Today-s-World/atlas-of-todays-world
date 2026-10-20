/**
 * Custom code in "Maps & charts" (visuals of kind 'html', ADR-032): an
 * infographic the editors paste as a whole HTML block, with its own styles and
 * scripts. It never becomes part of the site's pages. /api/visual-html/<id>
 * serves it as a document of its own under `VISUAL_HTML_CSP`, whose `sandbox`
 * gives it an opaque origin even when opened directly (no cookies, no storage,
 * no access to our pages or the Supabase session), and the page frames that
 * URL in its own iframe without allow-same-origin (HtmlFrame). The code may
 * load scripts, styles, images and data from any https host — inside the
 * sandbox it holds nothing worth stealing.
 *
 * No server dependency: the proxy, the route and the client frame import it.
 */

/** Where a visual's code is served (one path per visual: `${VISUAL_HTML_PATH}/<id>`). */
export const VISUAL_HTML_PATH = "/api/visual-html";

export const visualHtmlSrc = (id: string) => `${VISUAL_HTML_PATH}/${encodeURIComponent(id)}`;

/** `type` of the message the frame's height comes in (from our script in the document). */
export const VISUAL_HTML_HEIGHT_MESSAGE = "atlas-visual-html-height";

/** Bounds for a reported height, px: a broken report can't collapse or stretch the page. */
export const VISUAL_HTML_HEIGHT = { min: 120, max: 6000, initial: 600 } as const;

/**
 * The frame's sandbox: the code runs its scripts and opens links in a new tab
 * (outside the sandbox, so those pages work normally). Never allow-same-origin
 * (the document comes from our origin), never top navigation, forms or downloads.
 */
export const VISUAL_HTML_SANDBOX = "allow-scripts allow-popups allow-popups-to-escape-sandbox";

/**
 * Policy of the served document. `sandbox` repeats the iframe's (and holds
 * when the URL is opened on its own). Only the site frames it: its origin is
 * named in `frame-ancestors`, not 'self' — inside a sandboxed frame the
 * document's own origin is opaque, and browsers then match 'self' against
 * nothing (the frame stays empty). For the same reason no X-Frame-Options:
 * SAMEORIGIN fails the same way, and frame-ancestors overrides it anyway.
 */
export function visualHtmlCsp({
  dev,
  origins,
}: {
  dev: boolean;
  origins: readonly string[];
}): string {
  return [
    `sandbox ${VISUAL_HTML_SANDBOX}`,
    "default-src 'none'",
    "script-src 'unsafe-inline' https:",
    "style-src 'unsafe-inline' https:",
    "img-src https: data: blob:",
    "font-src https: data:",
    "connect-src https:",
    "media-src https:",
    "worker-src blob:",
    "form-action 'none'",
    "base-uri 'none'",
    `frame-ancestors ${[...new Set(origins)].join(" ")}`,
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

/**
 * Headers of the served document (the proxy sets them too, in place of the
 * site's). `origins`: the site's, as the request came in (production, a
 * preview deployment, localhost) and as configured (a domain in front of it).
 */
export function visualHtmlHeaderEntries({
  dev,
  origins,
}: {
  dev: boolean;
  origins: readonly string[];
}): [string, string][] {
  const headers: [string, string][] = [
    ["Content-Security-Policy", visualHtmlCsp({ dev, origins })],
    ["X-Content-Type-Options", "nosniff"],
    ["Referrer-Policy", "strict-origin-when-cross-origin"],
    ["Permissions-Policy", "geolocation=(), microphone=(), camera=(), payment=()"],
    ["X-Robots-Tag", "noindex, nofollow"],
  ];
  if (!dev) headers.push(["Strict-Transport-Security", "max-age=63072000; includeSubDomains"]);
  return headers;
}

/**
 * Our one script in the document: reports the content's height to the frame,
 * on load and whenever the body resizes. Fixed text (no data in it).
 */
const HEIGHT_SCRIPT = `<script>(function(){var last=0;function send(){var b=document.body;if(!b)return;var h=Math.ceil(b.scrollHeight);if(h>0&&h!==last){last=h;parent.postMessage({type:"${VISUAL_HTML_HEIGHT_MESSAGE}",height:h},"*");}}if(window.ResizeObserver&&document.body){new ResizeObserver(send).observe(document.body);}addEventListener("load",send);send();})();</script>`;

const WHOLE_DOCUMENT = /<!doctype\s|<html[\s>]/i;
const BODY_END = /<\/body\s*>(?![\s\S]*<\/body\s*>)/i;

/**
 * The stored code → the served document. A fragment (the usual paste) is
 * wrapped in a minimal page — links open in a new tab, no margins; a whole
 * document is kept as it is. Either way the height script goes last in the body.
 */
export function visualHtmlDocument(code: string, title: string): string {
  if (WHOLE_DOCUMENT.test(code)) {
    return BODY_END.test(code)
      ? code.replace(BODY_END, `${HEIGHT_SCRIPT}</body>`)
      : `${code}${HEIGHT_SCRIPT}`;
  }
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeText(title)}</title>
<base target="_blank">
<style>html,body{margin:0;padding:0}</style>
</head>
<body>
${code}
${HEIGHT_SCRIPT}
</body>
</html>`;
}

/** Text for an HTML element's content. */
function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * A message from a custom-code frame → its height, or null. The caller checks
 * that it came from its own frame (`event.source`); a sandboxed document's
 * origin is the opaque "null".
 */
export function visualHtmlHeight(origin: string, data: unknown): number | null {
  if (origin !== "null" || typeof data !== "object" || data === null) return null;
  const { type, height } = data as { type?: unknown; height?: unknown };
  if (type !== VISUAL_HTML_HEIGHT_MESSAGE || typeof height !== "number") return null;
  if (!Number.isFinite(height)) return null;
  return Math.round(Math.min(VISUAL_HTML_HEIGHT.max, Math.max(VISUAL_HTML_HEIGHT.min, height)));
}
