import { routes } from "@/config/routes";

const KIND_KEY = {
  region: "kindRegion",
  country: "kindCountry",
  issue: "kindIssue",
  news: "kindNews",
} as const;

/**
 * Message key of a search hit's label (`messages.search[...]`). Topics and news
 * items share the database's "news" kind; the address tells them apart.
 * Shared by the map's search dock and the /search page; null for an unknown kind.
 */
export function searchKindKey(hit: {
  kind: string;
  url: string;
}): (typeof KIND_KEY)[keyof typeof KIND_KEY] | "kindTopic" | null {
  if (hit.kind === "news" && hit.url.startsWith(`${routes.topics}/`)) return "kindTopic";
  return hit.kind in KIND_KEY ? KIND_KEY[hit.kind as keyof typeof KIND_KEY] : null;
}

/** Places before articles, countries first — the same order on every screen. */
const KIND_ORDER: Readonly<Record<string, number>> = { country: 0, region: 1, issue: 2 };
const kindRank = (kind: string) => KIND_ORDER[kind] ?? 3;

/**
 * Search hits grouped by kind — countries, regions, global issues, then topics
 * and news — keeping the database's ranking inside each group. The header
 * search on any device and the /search page show the same list.
 */
export function groupSearchHits<T extends { kind: string }>(hits: readonly T[]): T[] {
  return hits
    .map((hit, index) => ({ hit, index }))
    .sort((a, b) => kindRank(a.hit.kind) - kindRank(b.hit.kind) || a.index - b.index)
    .map(({ hit }) => hit);
}
