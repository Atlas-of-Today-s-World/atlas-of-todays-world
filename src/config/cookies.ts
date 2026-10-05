/**
 * Cookie notice (CookieNotice): the browser storage key that marks it as seen.
 * Kept free of path aliases, so playwright.config.ts can import it too.
 */
export const COOKIE_NOTICE_KEY = "atlas:cookie-notice";
/** Seconds the notice stays before it closes by itself. */
export const COOKIE_NOTICE_SECONDS = 10;
