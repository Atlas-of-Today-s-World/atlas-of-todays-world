import "server-only";
import { unstable_cache } from "next/cache";
import { PUBLIC_REVALIDATE_SECONDS, tags } from "@/lib/cache/tags";
import { must, rowsOf } from "@/lib/db/result";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * Open positions for the public /careers pages — cached under `careers`,
 * refreshed by every save in the admin. Only `open` rows reach anon (RLS).
 */

/** Columns of a position in the list (anon has no grant on the others). */
const LIST_COLUMNS = "slug, title, location, job_type, summary, opened_at, updated_at";

export interface PositionSummary {
  slug: string;
  title: string;
  location: string;
  job_type: string;
  summary: string;
  opened_at: string | null;
  updated_at: string;
}

export interface Position extends PositionSummary {
  id: string;
  body_html: string;
}

/** Every open position, newest first. */
export const getOpenPositions = unstable_cache(
  async (): Promise<PositionSummary[]> =>
    rowsOf(
      await createPublicClient()
        .from("job_positions")
        .select(LIST_COLUMNS)
        .eq("status", "open")
        .order("opened_at", { ascending: false }),
      "careers",
    ),
  ["careers-open"],
  { tags: [tags.careers], revalidate: PUBLIC_REVALIDATE_SECONDS },
);

/** One open position with its profile; null when there is none by that slug (or it isn't open). */
export const getOpenPosition = unstable_cache(
  async (slug: string): Promise<Position | null> =>
    must(
      await createPublicClient()
        .from("job_positions")
        .select(`id, body_html, ${LIST_COLUMNS}`)
        .eq("slug", slug)
        .eq("status", "open")
        .maybeSingle(),
      "careers",
    ),
  ["careers-position"],
  { tags: [tags.careers], revalidate: PUBLIC_REVALIDATE_SECONDS },
);
