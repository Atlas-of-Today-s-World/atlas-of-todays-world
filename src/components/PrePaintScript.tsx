import { COOKIE_NOTICE_KEY } from "@/config/cookies";

/** Attribute on <html> once the visitor has seen the cookie notice (globals.css hides it). */
const COOKIES_SEEN_ATTRIBUTE = "data-cookies-seen";

/**
 * Runs while the HTML is still being parsed, before the first paint: marks
 * <html> when the cookie notice was already seen, so the server-rendered notice
 * never flashes for returning visitors. The notice itself is in the static HTML
 * — painted with the page instead of after hydration, it's no longer a late
 * Largest Contentful Paint. Fixed code with no data in it (the key is a
 * constant), hence the one allowed inline script besides JSON-LD.
 */
const CODE = `try{localStorage.getItem(${JSON.stringify(COOKIE_NOTICE_KEY)})==="1"&&document.documentElement.setAttribute(${JSON.stringify(COOKIES_SEEN_ATTRIBUTE)},"")}catch(e){}`;

export function PrePaintScript() {
  return <script dangerouslySetInnerHTML={{ __html: CODE }} />;
}
