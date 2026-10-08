/**
 * Atlas languages (G5, P15). The site is English only (decision 2026-10-05).
 * English stays without a prefix in the URL. The routing still supports more
 * languages: add the code here + messages/<code>.json (other languages get a
 * `/<code>/…` prefix) and bring back a language switcher in the header.
 */
export const LOCALES = ["en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export const isLocale = (value: string | undefined | null): value is Locale =>
  (LOCALES as readonly string[]).includes(value ?? "");

/** Path in the given language: English without a prefix, otherwise `/cs/…`. */
export function localePath(locale: Locale, path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (locale === DEFAULT_LOCALE) return clean;
  return clean === "/" ? `/${locale}` : `/${locale}${clean}`;
}

/**
 * Drops the `/en` prefix of the internal route English pages are rendered under
 * (`/en/country/x` → `/country/x`). On the server `usePathname()` can return
 * that internal path, so anything reading the page from it must strip it first.
 */
export const withoutDefaultPrefix = (path: string): string =>
  path === `/${DEFAULT_LOCALE}`
    ? "/"
    : path.startsWith(`/${DEFAULT_LOCALE}/`)
      ? path.slice(DEFAULT_LOCALE.length + 1)
      : path;

/**
 * Language and path without the language prefix from the browser URL
 * (`/cs/country/x` → cs, `/country/x`; `/country/x` → en, unchanged).
 */
export function splitLocale(pathname: string): { locale: Locale; path: string } {
  const [, first, ...rest] = pathname.split("/");
  if (first !== DEFAULT_LOCALE && isLocale(first)) {
    return { locale: first, path: `/${rest.join("/")}` };
  }
  return { locale: DEFAULT_LOCALE, path: pathname || "/" };
}
