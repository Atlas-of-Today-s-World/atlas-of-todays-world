import "server-only";
import { MAP_LAYERS } from "@/features/entries/constants";
import {
  getEncyclopediaEntries,
  getPlannedTopics,
  getTopicPlaces,
} from "@/features/entries/queries";
import type { PlaceTopics, TopicPlace } from "@/features/entries/types";
import type { PlaceKind } from "@/features/geography/kinds";
import type { Atlas } from "@/features/geography/types";
import { countTopics, type TopicCounts } from "./map-counts";
import { routes } from "@/config/routes";

/** Query parameter of the Topics list filter, per kind of place. */
const TOPIC_FILTER: Record<PlaceKind, string> = {
  country: "country",
  region: "region",
  issue: "issue",
};

const groupsOf = (atlas: Atlas) => ({
  regionOf: Object.fromEntries(atlas.countries.map((c) => [c.iso3, c.region?.slug])),
  issues: atlas.issues,
});

/** Which topics belong to which place — the same rule as the counts on the globe. */
export async function topicIndex(atlas: Atlas) {
  const [places, entries] = await Promise.all([getTopicPlaces(), getEncyclopediaEntries()]);
  return { counts: countTopics(places, groupsOf(atlas)), entries };
}

/**
 * Planned topics placed by the same rule, as if on every layer (they have no
 * layers of their own yet). They have no slug: the key is their index.
 */
async function plannedIndex(atlas: Atlas) {
  const planned = await getPlannedTopics();
  const places: TopicPlace[] = planned.map((topic, index) => ({
    slug: String(index),
    title: topic.title,
    region: topic.region,
    issue: topic.issue,
    countries: topic.countries,
    layers: MAP_LAYERS,
  }));
  return { counts: countTopics(places, groupsOf(atlas)), planned };
}

const listOf = (counts: TopicCounts, kind: PlaceKind) =>
  kind === "country" ? counts.countries : kind === "region" ? counts.regions : counts.issues;

/** Related topics of one place, with the link to the filtered Topics list. */
export async function relatedTopics(
  atlas: Atlas,
  kind: PlaceKind,
  key: string,
): Promise<PlaceTopics> {
  const [{ counts, entries }, upcoming] = await Promise.all([
    topicIndex(atlas),
    plannedIndex(atlas),
  ]);
  const slugs = new Set(listOf(counts, kind)[key] ?? []);
  const plannedKeys = new Set(listOf(upcoming.counts, kind)[key] ?? []);
  return {
    items: entries.filter((entry) => slugs.has(entry.slug)),
    planned: upcoming.planned.filter((_, index) => plannedKeys.has(String(index))),
    href: `${routes.entries}?${TOPIC_FILTER[kind]}=${encodeURIComponent(key.toLowerCase())}`,
  };
}
