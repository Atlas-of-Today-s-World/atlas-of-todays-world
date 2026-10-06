/**
 * How many topics belong to each place on the globe (ADR-024). Pure, so the
 * server computes it once per page and a unit test pins the rules:
 *
 * - countries layer: a country counts the topics placed on it, on its region
 *   and on any global issue / country group it belongs to (Czechia = its own
 *   topic + the Europe topic = 2);
 * - regions layer: a region counts its own topics and every topic of its
 *   countries (so a region never shows fewer than any of its countries);
 * - global issues layer: a group counts its own topics and the topics placed
 *   on any of its countries;
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

export function countTopics(places: readonly TopicPlace[], groups: Groups): TopicCounts {
  const counts: TopicCounts = { countries: {}, regions: {}, issues: {} };
  const issuesOf = new Map<string, string[]>();
  const membersOf = new Map<string, string[]>();
  for (const issue of groups.issues) {
    membersOf.set(issue.slug, issue.countries);
    for (const iso3 of issue.countries)
      issuesOf.set(iso3, [...(issuesOf.get(iso3) ?? []), issue.slug]);
  }
  const isoCodes = new Set([...Object.keys(groups.regionOf), ...issuesOf.keys()]);
  for (const topic of places) for (const iso3 of topic.countries) isoCodes.add(iso3);

  for (const topic of places) {
    const inCountries = topic.layers.includes("countries");
    const inRegions = topic.layers.includes("regions");
    const inIssues = topic.layers.includes("issues");
    if (inRegions && topic.region) add(counts.regions, topic.region, topic.slug);
    if (inIssues && topic.issue) add(counts.issues, topic.issue, topic.slug);

    for (const iso3 of isoCodes) {
      const region = groups.regionOf[iso3];
      const own = topic.countries.includes(iso3);
      const viaRegion = Boolean(region) && topic.region === region;
      const viaIssue = topic.issue !== null && (issuesOf.get(iso3) ?? []).includes(topic.issue);
      if (!(own || viaRegion || viaIssue)) continue;
      if (inCountries) add(counts.countries, iso3, topic.slug);
      // A region holds every topic of its countries, so it never shows fewer than one of them.
      if (inRegions && region) add(counts.regions, region, topic.slug);
    }

    // A country group holds the topics placed on any of its countries.
    if (inIssues) {
      for (const [slug, members] of membersOf) {
        if (topic.countries.some((iso3) => members.includes(iso3)))
          add(counts.issues, slug, topic.slug);
      }
    }
  }
  return counts;
}

/** Counts only (what the globe draws). */
export function badgeNumbers(counts: Record<string, string[]>): Record<string, number> {
  return Object.fromEntries(Object.entries(counts).map(([key, list]) => [key, list.length]));
}
