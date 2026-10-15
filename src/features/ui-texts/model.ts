import { LEGAL_NAV, MAIN_NAV } from "@/config/navigation";
import type { MessageOverrides } from "@/lib/i18n/messages";
import en from "@/messages/en.json";

/**
 * Public UI texts the team can change in the admin (Admin → UI texts, table
 * `ui_text_overrides`). Plain data and checks without a server or Zod
 * dependency, so the admin form (client) can use them as well; the public read
 * is in queries.ts, the admin's in editorial.ts.
 *
 * The keys are the texts of en.json, flattened to dot paths
 * (`home.title`, `patrons.benefits.0.title`) — the list is derived from the
 * bundled en.json, so it always matches the code that reads the texts. A key
 * that is not there (renamed, removed) is refused when saving and ignored
 * when reading.
 */

/** Longest text the team may write (DB CHECK on ui_text_overrides.value). */
export const MAX_TEXT_LENGTH = 2000;

/**
 * The one allowlist of what is editable: every top-level namespace of en.json
 * except these. Sign-in, the reader's account and the team invitation are the
 * security-relevant flows (their wording, including the error texts the code
 * emits by code, stays as reviewed in the repository); they are not content.
 */
const LOCKED_NAMESPACES: ReadonlySet<string> = new Set(["auth", "account", "invite"]);

/**
 * Texts edited elsewhere in the admin: the menu labels live in Admin → Site
 * menus (nav_items); en.json holds only their fallback, so changing it here
 * would not show. (The "Sign in" link is not a menu item and stays editable.)
 */
const MANAGED_ELSEWHERE: ReadonlySet<string> = new Set(
  [...MAIN_NAV, ...LEGAL_NAV].map((item) => `nav.${item.key}`),
);

export interface UiText {
  /** Dot path in en.json. */
  key: string;
  /** Top-level group (`home`, `patrons`…) — the admin's filter. */
  namespace: string;
  /** The built-in text from en.json. */
  defaultText: string;
}

function flatten(node: unknown, path: string, out: UiText[]): UiText[] {
  if (typeof node === "string") {
    out.push({ key: path, namespace: path.split(".")[0] ?? path, defaultText: node });
  } else if (typeof node === "object" && node !== null) {
    for (const [key, child] of Object.entries(node)) {
      flatten(child, path ? `${path}.${key}` : key, out);
    }
  }
  return out;
}

/** Every text of en.json, in the file's order. */
const ALL_TEXTS: readonly UiText[] = flatten(en, "", []);

/**
 * May the team change this text? Its namespace is not locked, and its default
 * has no `<` — those (llms.txt's "<page title>" pattern) can't be written as
 * plain text under the no-HTML rule, so they stay in the code.
 */
const editable = (text: UiText) =>
  !LOCKED_NAMESPACES.has(text.namespace) &&
  !MANAGED_ELSEWHERE.has(text.key) &&
  !text.defaultText.includes("<");

/** The editable texts, in en.json order (the admin's list). */
export const EDITABLE_TEXTS: readonly UiText[] = ALL_TEXTS.filter(editable);

const BY_KEY: ReadonlyMap<string, UiText> = new Map(EDITABLE_TEXTS.map((text) => [text.key, text]));

/** The editable text of this key, or undefined (unknown, or not editable). */
export const editableText = (key: string): UiText | undefined => BY_KEY.get(key);

/** `{name}` placeholders the code fills in (the same pattern as `format`). */
export function placeholders(text: string): string[] {
  return [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? ""))].sort();
}

/** Same set of placeholders (order and repetition don't matter). */
const samePlaceholders = (a: string, b: string) =>
  placeholders(a).join("\u0000") === placeholders(b).join("\u0000");

/** Line ends as the database stores them. */
export const normalizeText = (value: string) => value.replace(/\r\n?/g, "\n");

/**
 * Why this override can't be saved (null = it can). Used by the admin form's
 * validation and again when the public site reads the table, so a row that
 * doesn't fit the current en.json (a key renamed, placeholders changed in the
 * code) never reaches a page.
 */
export function overrideProblem(
  key: string,
  value: string,
): { field: "key" | "value"; message: string } | null {
  const text = BY_KEY.get(key);
  if (!text) return { field: "key", message: "This text doesn't exist or can't be changed here." };
  if (value.trim() === "") return { field: "value", message: "Please fill this in." };
  if (value.length > MAX_TEXT_LENGTH) {
    return { field: "value", message: `At most ${MAX_TEXT_LENGTH} characters.` };
  }
  if (value.includes("<")) {
    return { field: "value", message: "Plain text only — the “<” character isn't allowed." };
  }
  if (!samePlaceholders(value, text.defaultText)) {
    const expected = placeholders(text.defaultText);
    return {
      field: "value",
      message: expected.length
        ? `Keep exactly these placeholders: ${expected.map((name) => `{${name}}`).join(", ")}.`
        : "This text has no placeholders — remove the {…}.",
    };
  }
  return null;
}

/** The rows that fit the current en.json, as key → text (others are left out). */
export function validOverrides(
  rows: readonly { key: string; value: string }[] | null,
): MessageOverrides {
  const out: Record<string, string> = {};
  for (const row of rows ?? []) {
    if (overrideProblem(row.key, row.value) === null) out[row.key] = row.value;
  }
  return out;
}
