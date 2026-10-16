import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import { summarise, summaryStart, type ConversionRow, type ConversionSummary } from "./summary";

/** PostgREST answers at most this many rows at once; longer reads go page by page. */
const PAGE = 1000;

/**
 * Conversion counts for the admin overview (layer: features/<domain>/editorial.ts).
 * Read under the signed-in person's rights: RLS lets only members "v" (and the
 * admin) see them. The rows are bounded by the allowlists (events × page
 * groups × referrers × 30 days), usually one page. A failed read returns
 * null — the overview still opens and the card says the numbers are unavailable.
 */
export async function conversionSummary(today = new Date()): Promise<ConversionSummary | null> {
  const supabase = await createServerClient();
  const rows: ConversionRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("conversion_events_daily")
      .select("day, event, referrer_group, count")
      .gte("day", summaryStart(today))
      // A stable order, so pages neither skip nor repeat rows.
      .order("day")
      .order("event")
      .order("path_group")
      .order("referrer_group")
      .range(from, from + PAGE - 1);
    if (error) {
      console.error("[conversions]", error.message);
      return null;
    }
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return summarise(rows, today);
}
