import { cache } from "react";
import { DEFAULT_LOCALE, isLocale, type Locale } from "./config";
import { getMessages, type Messages } from "./messages";

/** Jazyk právě vykreslovaného požadavku (React cache = jeden požadavek). */
const current = cache((): { locale: Locale } => ({ locale: DEFAULT_LOCALE }));

/**
 * Jazyk z parametrů routy `[locale]` (neplatný → výchozí; layout ho odmítl 404).
 * Zároveň ho zapamatuje pro serverové komponenty pod stránkou (`getT`), takže
 * je není třeba protahovat přes props.
 */
export async function localeFrom(params: Promise<{ locale?: string }>): Promise<Locale> {
  const { locale } = await params;
  const resolved = isLocale(locale) ? locale : DEFAULT_LOCALE;
  current().locale = resolved;
  return resolved;
}

/** Jazyk požadavku pro serverové komponenty (stránka ho nastaví přes localeFrom). */
export const getRequestLocale = (): Locale => current().locale;

/** Texty UI v jazyce požadavku (serverové komponenty). */
export const getT = (): Messages => getMessages(getRequestLocale());
