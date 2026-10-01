/**
 * Jazyky Atlasu (G5, P15). Angličtina je výchozí a zůstává bez předpony v
 * adrese (stávající odkazy a SEO); ostatní jazyky mají předponu `/cs/…`.
 * Nový jazyk = přidat sem kód + messages/<kód>.json, kód nic dalšího nechce.
 */
export const LOCALES = ["en", "cs"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/** Název jazyka v něm samém (přepínač jazyků). */
export const LOCALE_NAMES: Record<Locale, string> = { en: "English", cs: "Čeština" };

export const isLocale = (value: string | undefined | null): value is Locale =>
  (LOCALES as readonly string[]).includes(value ?? "");

/** Cesta v daném jazyce: angličtina bez předpony, jinak `/cs/…`. */
export function localePath(locale: Locale, path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (locale === DEFAULT_LOCALE) return clean;
  return clean === "/" ? `/${locale}` : `/${locale}${clean}`;
}
