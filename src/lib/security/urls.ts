/**
 * URL z dat do `href`, `src` a CSS `url()` (ARCHITEKTURA 8.1, S5).
 *
 * Povoluje jen https:, mailto: (u odkazů) a relativní cesty na vlastní web.
 * Cokoli jiného (javascript:, data:, //cizí.host, http:) vrací null — volající
 * pak prvek nevykreslí.
 */
export function safeUrl(value: unknown, { allowMailto = false } = {}): string | null {
  if (typeof value !== "string") return null;
  const url = value.trim();
  if (!url || /[\u0000-\u001f\u007f]/.test(url)) return null;

  // Relativní cesta na vlastní web, ne protocol-relative "//host".
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
 * Hodnota pro CSS `background-image`. Uvozovky a závorky jsou escapované, aby
 * URL nemohla opustit `url("…")` a vložit další CSS.
 */
export function cssBackgroundImage(value: unknown): string | undefined {
  const url = safeUrl(value);
  if (!url) return undefined;
  // encodeURIComponent závorky neescapuje, proto ručně (safeUrl už vyřadil řídicí znaky).
  const escaped = url.replace(/["'\\()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `url("${escaped}")`;
}
