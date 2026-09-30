/**
 * Cíl přesměrování z parametru `next` / `redirectTo` (ARCHITEKTURA 8.1, S6).
 * Jen cesta na vlastním webu; jinak `fallback`. Chrání před open redirectem
 * a před `javascript:` URL v `window.location`.
 */
export function safeRedirect(value: unknown, fallback = "/"): string {
  if (typeof value !== "string") return fallback;
  // Řídicí znaky (i na okrajích) prohlížeč v URL zahodí nebo přeloží — odmítnout.
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;
  const target = value.trim();
  // Jen cesta od kořene; "//host" je protocol-relative a "\" prohlížeč čte jako "/".
  if (!target.startsWith("/") || target.startsWith("//") || target.includes("\\")) {
    return fallback;
  }
  return target;
}
