import { cache } from "react";
import { DEFAULT_LOCALE, isLocale, type Locale } from "./config";
import { getMessages, type Messages } from "./messages";

/** Language of the request being rendered (React cache = one request). */
const current = cache((): { locale: Locale } => ({ locale: DEFAULT_LOCALE }));

/**
 * Language from the `[locale]` route params (invalid → default; the layout already rejected it with 404).
 * Also remembers it for server components below the page (`getT`), so it
 * doesn't need to be threaded through props.
 */
export async function localeFrom(params: Promise<{ locale?: string }>): Promise<Locale> {
  const { locale } = await params;
  const resolved = isLocale(locale) ? locale : DEFAULT_LOCALE;
  current().locale = resolved;
  return resolved;
}

/** Request language for server components (the page sets it via localeFrom). */
export const getRequestLocale = (): Locale => current().locale;

/** UI texts in the request language (server components). */
export const getT = (): Messages => getMessages(getRequestLocale());
