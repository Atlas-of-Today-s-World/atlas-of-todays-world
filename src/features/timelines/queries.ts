import "server-only";
import { unstable_cache } from "next/cache";
import { PUBLIC_REVALIDATE_SECONDS, tags } from "@/lib/cache/tags";
import type { Timeline } from "@/lib/content-types";
import { must } from "@/lib/db/result";
import { createPublicClient } from "@/lib/supabase/public";
import { EVENT_COLUMNS, toTimeline, type EventRow } from "./rows";

/**
 * A country's own timeline for its page, cached with the country's profile
 * text (`tags.country`), which the timeline editor refreshes. null = no events,
 * and the page shows nothing. Regions and global issues read theirs with the
 * portrait (`portrait()`), topics with their page (`getEncyclopediaEntry`).
 */
export function getCountryTimeline(iso3: string): Promise<Timeline | null> {
  return unstable_cache(
    async () => {
      const row = must(
        await createPublicClient()
          .from("countries")
          .select(`timeline_title, timeline_subtitle, timeline_events(${EVENT_COLUMNS})`)
          .eq("iso3", iso3)
          .maybeSingle(),
        "timeline: country",
      ) as unknown as {
        timeline_title: string | null;
        timeline_subtitle: string | null;
        timeline_events: EventRow[];
      } | null;
      return row ? toTimeline(row, row.timeline_events) : null;
    },
    ["country-timeline", iso3],
    { tags: [tags.country(iso3)], revalidate: PUBLIC_REVALIDATE_SECONDS },
  )();
}

/**
 * ISO3 codes of the countries with at least one timeline event: their own
 * content counts as created (the check mark on the globe's country pills).
 */
export const getCountriesWithTimeline = unstable_cache(
  async (): Promise<string[]> => {
    const rows = must(
      await createPublicClient()
        .from("timeline_events")
        .select("country_iso3")
        .not("country_iso3", "is", null),
      "timeline: countries",
    );
    return [...new Set(rows.flatMap((row) => (row.country_iso3 ? [row.country_iso3] : [])))].sort();
  },
  ["countries-with-timeline"],
  { tags: [tags.countryTimelines], revalidate: PUBLIC_REVALIDATE_SECONDS },
);
