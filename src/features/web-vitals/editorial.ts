import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import { TREND_DAYS, VITALS_WINDOWS, summariseVitals, type VitalsSummary } from "./summary";

/**
 * Core Web Vitals for the admin overview (layer: features/<domain>/editorial.ts).
 * web_vitals_p75() computes the percentiles in the database from the daily
 * histograms, under the signed-in person's rights (members "v" and the admin).
 * At most 280 rows a read. A failed read returns null — the overview still
 * opens and the section says the numbers are unavailable.
 */
export async function webVitalsSummary(today = new Date()): Promise<VitalsSummary | null> {
  const supabase = await createServerClient();
  const [week, month, daily] = await Promise.all([
    supabase.rpc("web_vitals_p75", { p_days: VITALS_WINDOWS.week }),
    supabase.rpc("web_vitals_p75", { p_days: VITALS_WINDOWS.month }),
    supabase.rpc("web_vitals_p75", { p_days: TREND_DAYS, p_by_day: true }),
  ]);
  const error = week.error ?? month.error ?? daily.error;
  if (error) {
    console.error("[web-vitals]", error.message);
    return null;
  }
  return summariseVitals(week.data ?? [], month.data ?? [], daily.data ?? [], today);
}
