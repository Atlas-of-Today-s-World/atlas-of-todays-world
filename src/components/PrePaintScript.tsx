import { PRE_PAINT_CODE } from "@/lib/pre-paint";

/**
 * Runs while the HTML is still being parsed, before the first paint: marks
 * <html> when the cookie notice was already seen, so the server-rendered notice
 * never flashes for returning visitors. The notice itself is in the static HTML
 * — painted with the page instead of after hydration, it's no longer a late
 * Largest Contentful Paint. Fixed code with no data in it (the key is a
 * constant), hence the one allowed inline script besides JSON-LD; the nonce CSP
 * of dynamic pages allows it by its hash (lib/pre-paint.ts).
 */
export function PrePaintScript() {
  return <script dangerouslySetInnerHTML={{ __html: PRE_PAINT_CODE }} />;
}
