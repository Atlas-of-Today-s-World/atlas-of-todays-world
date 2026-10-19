import "server-only";
import { unstable_cache } from "next/cache";
import { clampFeaturedCount, FEATURED_COUNT } from "@/features/home/config";
import { PUBLIC_REVALIDATE_SECONDS, tags } from "@/lib/cache/tags";
import { must } from "@/lib/db/result";
import { createPublicClient } from "@/lib/supabase/public";

/** A published entry for the home map, newest first; its place as slugs (named by the caller). */
export interface LatestEntry {
  slug: string;
  title: string;
  image?: string;
  background?: string;
  region: string | null;
  issue: string | null;
}

/** How many entry tiles the home map shows (set in the admin, Home page). */
const getFeaturedCount = unstable_cache(
  async (): Promise<number> => {
    const { data, error } = await createPublicClient()
      .from("home_settings")
      .select("featured_count")
      .eq("id", 1)
      .maybeSingle();
    // The count is a nicety: without it the default number of tiles shows.
    if (error) console.error(`[home featured] ${error.message}`);
    return clampFeaturedCount(data?.featured_count);
  },
  ["home-featured-count"],
  { tags: [tags.home], revalidate: PUBLIC_REVALIDATE_SECONDS },
);

/** Published entries (originals), the most recently published first. */
const getLatestEntries = unstable_cache(
  async (): Promise<LatestEntry[]> => {
    const data = must(
      await createPublicClient()
        .from("entries")
        // Anon may read only listed columns (DB-08).
        .select("slug, title, cover_url, hero_background, region_slug, special_slug")
        .eq("status", "published")
        .eq("kind", "entry")
        .is("translation_of", null)
        .order("published_on", { ascending: false, nullsFirst: false })
        // Same publish date: the one uploaded later first.
        .order("created_at", { ascending: false })
        .limit(FEATURED_COUNT.max),
      "latest entries",
    );
    return data.map((row) => ({
      slug: row.slug,
      title: row.title,
      image: row.cover_url ?? undefined,
      background: row.hero_background ?? undefined,
      region: row.region_slug,
      issue: row.special_slug,
    }));
  },
  ["latest-entries"],
  { tags: [tags.entries], revalidate: PUBLIC_REVALIDATE_SECONDS },
);

/** The entry tiles on the home map: the newest published, as many as set in the admin. */
export async function latestEntries(): Promise<LatestEntry[]> {
  const [entries, count] = await Promise.all([getLatestEntries(), getFeaturedCount()]);
  return entries.slice(0, count);
}
