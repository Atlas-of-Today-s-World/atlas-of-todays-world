/**
 * URLs from data into `href`, `src` and CSS `url()` (ARCHITEKTURA 8.1, S5).
 *
 * Allows only https:, mailto: (for links) and relative paths on our own site.
 * Anything else (javascript:, data:, //foreign.host, http:) returns null — the
 * caller then doesn't render the element.
 */
export function safeUrl(value: unknown, { allowMailto = false } = {}): string | null {
  if (typeof value !== "string") return null;
  const url = value.trim();
  if (!url || /[\u0000-\u001f\u007f]/.test(url)) return null;

  // Relative path on our own site, not protocol-relative "//host".
  if (url.startsWith("/")) return url.startsWith("//") || url.startsWith("/\\") ? null : url;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol === "https:") return parsed.href;
  if (allowMailto && parsed.protocol === "mailto:") return parsed.href;
  return null;
}

/**
 * Value for CSS `background-image`. Quotes and parentheses are escaped so the
 * URL can't leave `url("…")` and inject more CSS.
 */
export function cssBackgroundImage(value: unknown): string | undefined {
  const url = safeUrl(value);
  if (!url) return undefined;
  // encodeURIComponent doesn't escape parentheses, so do it by hand (safeUrl already dropped control chars).
  const escaped = url.replace(/["'\\()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `url("${escaped}")`;
}
