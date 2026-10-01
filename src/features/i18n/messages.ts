import cs from "@/messages/cs.json";
import en from "@/messages/en.json";
import type { Locale } from "./config";

/**
 * UI texts (ARCHITEKTURA 5.1: `messages/{locale}.json`). English is the
 * template — other languages must match its shape (type check below), so a
 * missing key fails already at build time.
 */
export type Messages = typeof en;

const MESSAGES: Record<Locale, Messages> = { en, cs: cs satisfies Messages };

export const getMessages = (locale: Locale): Messages => MESSAGES[locale];

/** Fills in `{name}` in the text. */
export function format(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}
