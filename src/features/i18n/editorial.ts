import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import { TRANSLATABLE, type TranslatableEntity } from "./translatable";

/** Tabulka a klíčový sloupec originálu (anglický text). */
const SOURCE = {
  region: { table: "regions", key: "slug", order: "position" },
  country: { table: "countries", key: "iso3", order: "name" },
  issue: { table: "special_regions", key: "slug", order: "name" },
  indicator: { table: "indicators", key: "id", order: "position" },
} as const;

type Row = Record<string, string | null>;

interface Filterable extends PromiseLike<{ data: unknown; error: { message: string } | null }> {
  order(column: string): Filterable;
  limit(count: number): Filterable;
  eq(column: string, value: string): Filterable;
}

async function originals(entity: TranslatableEntity, key?: string): Promise<Row[]> {
  const { table, key: keyColumn, order } = SOURCE[entity];
  const columns = [keyColumn, ...TRANSLATABLE[entity]].join(", ");
  const supabase = await createServerClient();
  // Tabulka se vybírá podle druhu celku, typy DB to staticky nevyjádří.
  const base = supabase.from(table).select(columns) as unknown as Filterable;
  const query = base.order(order).limit(1000);
  const { data, error } = await (key ? query.eq(keyColumn, key) : query);
  if (error) throw new Error(`[translations] ${error.message}`);
  return data as unknown as Row[];
}

async function translations(entity: TranslatableEntity, locale: string, key?: string) {
  const supabase = await createServerClient();
  let query = supabase
    .from("translations")
    .select("entity_key, field, value")
    .eq("entity", entity)
    .eq("locale", locale)
    .limit(5000);
  if (key) query = query.eq("entity_key", key);
  const { data, error } = await query;
  if (error) throw new Error(`[translations] ${error.message}`);
  return data;
}

export interface TranslationListItem {
  key: string;
  name: string;
  translatedName: string | null;
  done: number;
  total: number;
}

/** Celky jednoho druhu s počtem přeložených polí (seznam v administraci). */
export async function listTranslations(
  entity: TranslatableEntity,
  locale: string,
): Promise<TranslationListItem[]> {
  const [rows, done] = await Promise.all([originals(entity), translations(entity, locale)]);
  const keyColumn = SOURCE[entity].key;
  const nameField = TRANSLATABLE[entity][0];
  const byKey = new Map<string, Map<string, string>>();
  for (const row of done) {
    const fields = byKey.get(row.entity_key) ?? new Map<string, string>();
    fields.set(row.field, row.value);
    byKey.set(row.entity_key, fields);
  }
  // Pole, která v originálu nejsou vyplněná, se nepočítají (není co překládat).
  return rows.map((row) => {
    const key = row[keyColumn] as string;
    const fields = byKey.get(key);
    const present = TRANSLATABLE[entity].filter((field) => row[field]?.trim());
    return {
      key,
      name: (row[nameField] as string) ?? key,
      translatedName: fields?.get(nameField) ?? null,
      done: present.filter((field) => fields?.has(field)).length,
      total: present.length,
    };
  });
}

/** Originál a překlad jednoho celku pro formulář. */
export async function translationForEdit(entity: TranslatableEntity, key: string, locale: string) {
  const [rows, done] = await Promise.all([
    originals(entity, key),
    translations(entity, locale, key),
  ]);
  if (!rows[0]) return null;
  const translated = Object.fromEntries(done.map((row) => [row.field, row.value]));
  return {
    original: rows[0],
    fields: TRANSLATABLE[entity].map((field) => ({
      field,
      original: rows[0][field] ?? "",
      value: (translated[field] as string | undefined) ?? "",
    })),
  };
}
