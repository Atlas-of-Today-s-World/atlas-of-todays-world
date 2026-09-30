import "server-only";
import { createServerClient } from "@/lib/supabase/server";

/** Ukazatel se vším, co potřebuje editor (pod session uživatele, bez cache). */
export async function indicatorForEdit(id: string) {
  const supabase = await createServerClient();
  const [indicator, categories, values] = await Promise.all([
    supabase
      .from("indicators")
      .select(
        "id, label, short_label, description, unit, decimals, source, source_url, type, scale, domain_min, domain_max, ramp, higher_is_better, is_custom, latest_year",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("indicator_categories")
      .select("value, label, color")
      .eq("indicator_id", id)
      .order("value"),
    supabase
      .from("indicator_values")
      .select("country_iso3, value, year, note, source_note, is_manual, updated_at")
      .eq("indicator_id", id)
      .order("country_iso3")
      .limit(1000),
  ]);
  for (const result of [indicator, categories, values]) {
    if (result.error) throw new Error(`[indicators] ${result.error.message}`);
  }
  if (!indicator.data) return null;
  return {
    indicator: {
      ...indicator.data,
      type: indicator.data.type as "sequential" | "categorical",
      scale: indicator.data.scale as "linear" | "log",
      domain_min: indicator.data.domain_min === null ? null : Number(indicator.data.domain_min),
      domain_max: indicator.data.domain_max === null ? null : Number(indicator.data.domain_max),
    },
    categories: categories.data ?? [],
    values: values.data ?? [],
  };
}
