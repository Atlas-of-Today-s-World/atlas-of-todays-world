/**
 * The order of a portrait's sections — one list for the whole site (owner's
 * request of 2026-10-16, from the call with the Atlas team): the same run on a
 * country, a region and a global issue, in the side-panel preview and on the
 * full page. The intro and the key facts stay on top, outside this list.
 *
 * The editors change the order in Admin → Portrait layout; it lives in
 * `site_settings.portrait_sections`, whose CHECK holds exactly these five keys.
 * Plain data, no server dependency: the admin's client editor imports it too.
 */
export const SECTION_KEYS = ["timeline", "topics", "visuals", "resources", "faq"] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

/**
 * The order agreed on the call: intro → timeline → topics → maps & charts →
 * learn more → FAQ. It happens to be the keys' own order; a copy, so the two
 * can part if a key is ever added somewhere other than at the default's end.
 */
export const DEFAULT_SECTION_ORDER: readonly SectionKey[] = [...SECTION_KEYS];

/** How each section is named in the admin. */
export const SECTION_LABEL: Record<SectionKey, string> = {
  timeline: "Timeline",
  topics: "Topics by theme (four rows)",
  visuals: "Maps & charts",
  resources: "Learn more (sources)",
  faq: "Questions and answers (FAQ)",
};

const isKey = (value: unknown): value is SectionKey =>
  typeof value === "string" && (SECTION_KEYS as readonly string[]).includes(value);

/**
 * Any stored or submitted list → a full, valid order: unknown keys and repeats
 * are dropped, and a section missing from the list is added at the end in its
 * default place — so adding a sixth section later never hides it on sites whose
 * stored order predates it.
 */
export function normalizeSectionOrder(input: unknown): SectionKey[] {
  const seen = new Set<SectionKey>();
  for (const value of Array.isArray(input) ? input : []) {
    if (isKey(value)) seen.add(value);
  }
  for (const key of DEFAULT_SECTION_ORDER) seen.add(key);
  return [...seen];
}
