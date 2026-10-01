import type { AtlasSnapshot } from "@/features/geography/model";

/**
 * Která pole celků jdou přeložit (jediný seznam pro web i administraci).
 * Klíč celku: region a issue → slug, country → iso3, indicator → id.
 */
export const TRANSLATABLE = {
  region: ["name", "tagline", "summary"],
  country: ["name", "name_formal", "tagline", "blurb", "profile_html"],
  issue: ["name", "subtitle", "summary"],
  indicator: ["label", "short_label", "description"],
} as const;

export type TranslatableEntity = keyof typeof TRANSLATABLE;
export const TRANSLATABLE_ENTITIES = Object.keys(TRANSLATABLE) as TranslatableEntity[];

/** Sekce oprávnění celku — stejné jako translation_section() v DB. */
export const ENTITY_SECTION = {
  region: "regions",
  country: "regions",
  issue: "specials",
  indicator: "layers",
} as const satisfies Record<TranslatableEntity, string>;

/** Pole s HTML (při uložení projde sanitizací). */
export const HTML_FIELDS: ReadonlySet<string> = new Set(["profile_html"]);

export interface TranslationRow {
  entity: string;
  entity_key: string;
  field: string;
  value: string;
}

type Overrides = Map<string, Record<string, string>>;

function overrides(rows: TranslationRow[], entity: TranslatableEntity): Overrides {
  const allowed = new Set<string>(TRANSLATABLE[entity]);
  const out: Overrides = new Map();
  for (const row of rows) {
    if (row.entity !== entity || !allowed.has(row.field) || !row.value.trim()) continue;
    const fields = out.get(row.entity_key) ?? {};
    fields[row.field] = row.value;
    out.set(row.entity_key, fields);
  }
  return out;
}

function apply<T>(items: T[], key: (item: T) => string, map: Overrides): T[] {
  if (!map.size) return items;
  return items.map((item) => {
    const fields = map.get(key(item));
    return fields ? { ...item, ...fields } : item;
  });
}

/**
 * Snímek Atlasu s přeloženými texty. Co přeložené není, zůstane anglicky;
 * čísla, barvy a vazby se nemění. HTML profilu projde stejnou sanitizací
 * jako originál (při skládání modelu).
 */
export function localizeSnapshot(snapshot: AtlasSnapshot, rows: TranslationRow[]): AtlasSnapshot {
  if (!rows.length) return snapshot;
  return {
    ...snapshot,
    regions: apply(snapshot.regions, (r) => r.slug, overrides(rows, "region")),
    countries: apply(snapshot.countries, (c) => c.iso3, overrides(rows, "country")),
    issues: apply(snapshot.issues, (i) => i.slug, overrides(rows, "issue")),
    indicators: apply(snapshot.indicators, (i) => i.id, overrides(rows, "indicator")),
  };
}
