import "server-only";
import { TOPICS_PATH } from "@/config/navigation";
import {
  getEncyclopediaEntries,
  getTopicPlaces,
  type EntrySummary,
} from "@/features/entries/queries";
import type { Atlas } from "@/features/geography/types";
import type { Locale } from "@/features/i18n/config";
import { countTopics, type TopicCounts } from "./map-counts";

export type PlaceKind = "country" | "region" | "issue";

/** Query parameter of the Topics list filter, per kind of place. */
const TOPIC_FILTER: Record<PlaceKind, string> = {
  country: "country",
  region: "region",
  issue: "issue",
};

/** Which topics belong to which place — the same rule as the counts on the globe. */
export async function topicIndex(atlas: Atlas, locale: Locale) {
  const [places, entries] = await Promise.all([getTopicPlaces(), getEncyclopediaEntries(locale)]);
  const counts = countTopics(places, {
    regionOf: Object.fromEntries(atlas.countries.map((c) => [c.iso3, c.region?.slug])),
    issues: atlas.issues,
  });
  return { counts, entries };
}

const listOf = (counts: TopicCounts, kind: PlaceKind) =>
  kind === "country" ? counts.countries : kind === "region" ? counts.regions : counts.issues;

/** Related topics of one place, with the link to the filtered Topics list. */
export async function relatedTopics(
  atlas: Atlas,
  locale: Locale,
  kind: PlaceKind,
  key: string,
): Promise<{ items: EntrySummary[]; href: string }> {
  const { counts, entries } = await topicIndex(atlas, locale);
  const slugs = new Set(listOf(counts, kind)[key] ?? []);
  return {
    items: entries.filter((entry) => slugs.has(entry.slug)),
    href: `${TOPICS_PATH}?${TOPIC_FILTER[kind]}=${encodeURIComponent(key.toLowerCase())}`,
  };
}
