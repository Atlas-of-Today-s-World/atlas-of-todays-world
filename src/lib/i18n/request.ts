import "server-only";
import { cache } from "react";
import { getUiTextOverrides } from "@/features/ui-texts/queries";
import { DEFAULT_LOCALE, isLocale, type Locale } from "./config";
import { applyOverrides, getMessages, type MessageOverrides, type Messages } from "./messages";

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

/**
 * The team's text changes for this language (Admin → UI texts). They are
 * written over en.json, so only the default language has them.
 */
export const getOverridesFor = async (locale: Locale): Promise<MessageOverrides> =>
  locale === DEFAULT_LOCALE ? getUiTextOverrides() : {};

/**
 * UI texts in `locale` with the team's changes from the admin — what every
 * server-rendered page, metadata, feed and OG image shows. Cached (tag
 * `ui-texts`, no cookies or headers), so pages stay static / ISR; when the
 * changes can't be read, the en.json texts.
 */
export const getMessagesFor = cache(async (locale: Locale): Promise<Messages> =>
  applyOverrides(getMessages(locale), await getOverridesFor(locale)),
);

/** UI texts in the request language (server components). */
export const getT = (): Promise<Messages> => getMessagesFor(getRequestLocale());
