/**
 * How many topics belong to each place on the globe (ADR-024). Pure, so the
 * server computes it once per page and a unit test pins the rules:
 *
 * - countries layer: a country counts the topics placed on it, on its region
 *   and on any global issue / country group it belongs to (Czechia = its own
 *   topic + the Europe topic = 2);
 * - regions layer: a region counts the topics placed on the region;
 * - global issues layer: a group counts the topics placed on the group;
 * - a topic counts only on the layers it is shown on (`map_layers`).
 */
import type { MapLayer } from "@/features/entries/constants";

export interface TopicPlace {
  slug: string;
  title: string;
  region: string | null;
  issue: string | null;
  countries: string[];
  layers: readonly MapLayer[];
}

interface Groups {
  /** ISO3 → region slug. */
  regionOf: Record<string, string | undefined>;
  /** Global issue / country group slug → its countries. */
  issues: { slug: string; countries: string[] }[];
}

/** Place key → slugs of its topics, per globe layer. */
export interface TopicCounts {
  countries: Record<string, string[]>;
  regions: Record<string, string[]>;
  issues: Record<string, string[]>;
}

function add(target: Record<string, string[]>, key: string, slug: string) {
  const list = (target[key] ??= []);
  if (!list.includes(slug)) list.push(slug);
}

/**
 * Does the topic belong to the country: placed on it, on its region, or on a
 * global issue / country group it is in. The one rule for the globe counts and
 * the Topics filter.
 */
export function reachesCountry(
  topic: Pick<TopicPlace, "region" | "issue" | "countries">,
  iso3: string,
  region: string | undefined,
  issues: readonly string[],
): boolean {
  return (
    topic.countries.includes(iso3) ||
    (Boolean(region) && topic.region === region) ||
    (topic.issue !== null && issues.includes(topic.issue))
  );
}

export function countTopics(places: readonly TopicPlace[], groups: Groups): TopicCounts {
  const counts: TopicCounts = { countries: {}, regions: {}, issues: {} };
  const issuesOf = new Map<string, string[]>();
  for (const issue of groups.issues) {
    for (const iso3 of issue.countries)
      issuesOf.set(iso3, [...(issuesOf.get(iso3) ?? []), issue.slug]);
  }

  for (const topic of places) {
    if (topic.layers.includes("regions") && topic.region)
      add(counts.regions, topic.region, topic.slug);
    if (topic.layers.includes("issues") && topic.issue) add(counts.issues, topic.issue, topic.slug);
  }

  if (places.some((topic) => topic.layers.includes("countries"))) {
    const isoCodes = new Set([...Object.keys(groups.regionOf), ...issuesOf.keys()]);
    for (const topic of places) for (const iso3 of topic.countries) isoCodes.add(iso3);
    for (const iso3 of isoCodes) {
      const region = groups.regionOf[iso3];
      const issues = issuesOf.get(iso3) ?? [];
      for (const topic of places) {
        if (!topic.layers.includes("countries")) continue;
        if (reachesCountry(topic, iso3, region, issues)) add(counts.countries, iso3, topic.slug);
      }
    }
  }
  return counts;
}

/** Counts only (what the globe draws). */
export function badgeNumbers(counts: Record<string, string[]>): Record<string, number> {
  return Object.fromEntries(Object.entries(counts).map(([key, list]) => [key, list.length]));
}
