import { reachesCountry, type TopicPlace } from "./map-counts";

/** The Topics page filters by one place at a time: a country, a region or a special region. */
export type TopicFilterKind = "country" | "region" | "special";
export const TOPIC_FILTER_KINDS: readonly TopicFilterKind[] = ["country", "region", "special"];

export interface TopicFilter {
  kind: TopicFilterKind;
  value: string;
}

export interface PlaceIndex {
  /** ISO3 → region slug. */
  regionOf: Record<string, string>;
  /** ISO3 → special regions (global issues, custom regions) it belongs to. */
  specialsOf: Record<string, string[]>;
}

type Placed = Pick<TopicPlace, "region" | "issue" | "countries">;

/**
 * Does the topic belong to the filtered place. A country takes the same rule
 * as the globe counts (its own topics + its region's + its groups'); a region
 * or special region takes the topics placed on it.
 */
export function matchesFilter(topic: Placed, filter: TopicFilter, places: PlaceIndex): boolean {
  if (filter.kind === "region") return topic.region === filter.value;
  if (filter.kind === "special") return topic.issue === filter.value;
  return reachesCountry(
    topic,
    filter.value,
    places.regionOf[filter.value],
    places.specialsOf[filter.value] ?? [],
  );
}

/** Reads the one active filter from the page URL (`?country=CZE`, `?region=…`, `?special=…`). */
export function filterFromParams(params: URLSearchParams): TopicFilter | null {
  for (const kind of TOPIC_FILTER_KINDS) {
    const value = params.get(kind);
    if (value) return { kind, value };
  }
  return null;
}
