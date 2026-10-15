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

/**
 * Shortest word the site search looks for: the database's `search_query()`
 * skips shorter ones, so "a" or "of" alone can't match anything.
 */
const SEARCH_MIN_WORD = 3;

/**
 * Whether the site search has anything to look for — a word of at least
 * `SEARCH_MIN_WORD` letters or digits. Without one the endpoints answer with
 * no results without asking the database, and the search box shows a hint.
 */
export function isSearchable(query: string): boolean {
  return query.split(/[^\p{L}\p{N}]+/u).some((word) => [...word].length >= SEARCH_MIN_WORD);
}
