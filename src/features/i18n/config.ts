/**
 * Atlas languages (G5, P15). English is the default and stays without a prefix
 * in the URL (existing links and SEO); other languages have the prefix `/cs/…`.
 * New language = add the code here + messages/<code>.json; the code needs nothing else.
 */
export const LOCALES = ["en", "cs"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/** Language name in the language itself (language switcher). */
export const LOCALE_NAMES: Record<Locale, string> = { en: "English", cs: "Čeština" };

export const isLocale = (value: string | undefined | null): value is Locale =>
  (LOCALES as readonly string[]).includes(value ?? "");

/** Path in the given language: English without a prefix, otherwise `/cs/…`. */
export function localePath(locale: Locale, path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (locale === DEFAULT_LOCALE) return clean;
  return clean === "/" ? `/${locale}` : `/${locale}${clean}`;
}

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
