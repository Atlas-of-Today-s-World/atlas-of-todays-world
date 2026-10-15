import en from "@/messages/en.json";
import type { Locale } from "./config";

/**
 * UI texts (ARCHITEKTURA 5.1: `messages/{locale}.json`). English is the
 * template — other languages must match its shape (type check below), so a
 * missing key fails already at build time.
 *
 * The team can change the public texts in the admin (Admin → UI texts, table
 * `ui_text_overrides`). Server code reads the texts with those changes through
 * `getMessagesFor` / `getT` (features/i18n/request.ts); client components get
 * them from `LocaleProvider` (`useMessages`). `getMessages` is only the
 * built-in en.json — for the few places that need a value synchronously and
 * can't wait for the database (see its callers).
 */
export type Messages = typeof en;

const MESSAGES: Record<Locale, Messages> = { en };

/** The built-in texts (en.json) without the team's changes from the admin. */
export const getMessages = (locale: Locale): Messages => MESSAGES[locale] ?? MESSAGES.en;

/** Changed texts by key path (`"home.title"`, `"patrons.benefits.0.title"`) → text. */
export type MessageOverrides = Readonly<Record<string, string>>;

type Node = Record<string, unknown> | unknown[];

const isNode = (value: unknown): value is Node => typeof value === "object" && value !== null;

/**
 * The texts with the overrides applied (a deep copy; `base` is not touched).
 * Only an existing text can be replaced: a key that doesn't lead to a string
 * in `base` is ignored, so an override never changes the shape of the
 * messages (no new keys, no object turned into a string, nothing reached
 * through the prototype).
 */
export function applyOverrides<T extends object>(base: T, overrides: MessageOverrides): T {
  const entries = Object.entries(overrides);
  if (entries.length === 0) return base;
  const out = structuredClone(base);
  for (const [key, value] of entries) {
    const path = key.split(".");
    const last = path.pop();
    let node: unknown = out;
    for (const segment of path) {
      node = isNode(node) && Object.hasOwn(node, segment) ? (node as Node)[segment as never] : null;
    }
    if (last && isNode(node) && Object.hasOwn(node, last)) {
      const target = node as Record<string, unknown>;
      if (typeof target[last] === "string" && typeof value === "string") target[last] = value;
    }
  }
  return out;
}

/** Fills in `{name}` in the text. */
export function format(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}
