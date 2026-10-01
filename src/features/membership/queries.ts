import "server-only";
import { unstable_cache } from "next/cache";
import { PUBLIC_REVALIDATE_SECONDS, tags } from "@/lib/cache/tags";
import { createPublicClient } from "@/lib/supabase/public";

export interface PatronStats {
  patrons: number;
  monthlyEur: number;
}

/**
 * Aggregate progress towards the current goal. Anonymous readers only get the
 * two numbers from `patron_stats()` (security definer), never memberships.
 * Null when the database does not answer — the page then shows a dash.
 */
export const getPatronStats = unstable_cache(
  async (): Promise<PatronStats | null> => {
    const { data, error } = await createPublicClient().rpc("patron_stats");
    const row = data?.[0];
    if (error || !row) {
      console.error("[patron_stats]", error?.message ?? "no row");
      return null;
    }
    return { patrons: row.patrons, monthlyEur: Math.floor(Number(row.monthly_cents) / 100) };
  },
  ["patron-stats"],
  { tags: [tags.patrons], revalidate: PUBLIC_REVALIDATE_SECONDS },
);
