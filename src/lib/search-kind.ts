import { TOPICS_PATH } from "@/config/navigation";

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
  if (hit.kind === "news" && hit.url.startsWith(`${TOPICS_PATH}/`)) return "kindTopic";
  return hit.kind in KIND_KEY ? KIND_KEY[hit.kind as keyof typeof KIND_KEY] : null;
}
