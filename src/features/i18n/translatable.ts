import type { AtlasSnapshot } from "@/features/geography/model";

/**
 * Which unit fields can be translated. The site is English only now; the
 * overlay stays so a future language only needs rows in the translations table.
 * Unit key: region and issue → slug, country → iso3, indicator → id.
 */
const TRANSLATABLE = {
  region: ["name", "tagline", "summary"],
  country: ["name", "name_formal", "tagline", "blurb", "profile_html"],
  issue: ["name", "subtitle", "summary"],
  indicator: ["label", "short_label", "description"],
} as const;

type TranslatableEntity = keyof typeof TRANSLATABLE;

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
 * Atlas snapshot with translated texts. Whatever isn't translated stays English;
 * numbers, colours and relations don't change. Profile HTML goes through the same
 * sanitization as the original (when the model is assembled).
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
