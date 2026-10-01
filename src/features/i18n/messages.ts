import cs from "@/messages/cs.json";
import en from "@/messages/en.json";
import type { Locale } from "./config";

/**
 * Texty rozhraní (ARCHITEKTURA 5.1: `messages/{locale}.json`). Angličtina je
 * vzor — tvar ostatních jazyků musí sedět (typová kontrola níže), takže
 * chybějící klíč spadne už při buildu.
 */
export type Messages = typeof en;

const MESSAGES: Record<Locale, Messages> = { en, cs: cs satisfies Messages };

export const getMessages = (locale: Locale): Messages => MESSAGES[locale];

/** Doplní `{název}` v textu. */
export function format(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}
