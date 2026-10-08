import { COOKIE_NOTICE_KEY } from "@/config/cookies";

/** Attribute on <html> once the visitor has seen the cookie notice (globals.css hides it). */
const COOKIES_SEEN_ATTRIBUTE = "data-cookies-seen";

/**
 * The one inline script of the site (PrePaintScript): fixed code with no data
 * in it (the key is a constant).
 */
export const PRE_PAINT_CODE = `try{localStorage.getItem(${JSON.stringify(COOKIE_NOTICE_KEY)})==="1"&&document.documentElement.setAttribute(${JSON.stringify(COOKIES_SEEN_ATTRIBUTE)},"")}catch(e){}`;

/**
 * Its SHA-256 for the nonce CSP of dynamic pages (lib/security/csp.ts): the
 * script is rendered by the shared root layout, which can't carry a per-request
 * nonce without making every page dynamic. A test keeps it in step with the code.
 */
export const PRE_PAINT_HASH = "sha256-Dyuvd884CWwOJY1o5FnJkd9AtxJDpZlBUSV77wzhtsM=";
