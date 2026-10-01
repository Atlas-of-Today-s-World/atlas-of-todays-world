import { DEFAULT_LOCALE, isLocale, type Locale } from "./config";

/** Jazyk z parametrů routy `[locale]` (neplatný → výchozí; layout už ho odmítl 404). */
export async function localeFrom(params: Promise<{ locale?: string }>): Promise<Locale> {
  const { locale } = await params;
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
}
