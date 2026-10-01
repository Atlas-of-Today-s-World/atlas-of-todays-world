/**
 * Redirect target from the `next` / `redirectTo` parameter (ARCHITEKTURA 8.1, S6).
 * Only a path on our own site; otherwise `fallback`. Protects against open
 * redirects and against `javascript:` URLs in `window.location`.
 */
export function safeRedirect(value: unknown, fallback = "/"): string {
  if (typeof value !== "string") return fallback;
  // Browsers drop or translate control characters in URLs (even at the edges) — reject.
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;
  const target = value.trim();
  // Root-relative paths only; "//host" is protocol-relative and browsers read "\" as "/".
  if (!target.startsWith("/") || target.startsWith("//") || target.includes("\\")) {
    return fallback;
  }
  return target;
}
