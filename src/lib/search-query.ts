/** Longest query the search endpoints look at. */
const SEARCH_QUERY_MAX = 200;

/**
 * One spelling of a search query: trimmed, inner whitespace collapsed,
 * lowercase (the database search ignores case anyway). The browser asks with
 * it and the endpoints answer with it, so "Water ", "water" and "WATER" share
 * one CDN cache entry instead of three misses.
 */
export function normalizeSearchQuery(query: string): string {
  return query.replace(/\s+/g, " ").trim().toLowerCase().slice(0, SEARCH_QUERY_MAX).trimEnd();
}
