/**
 * Single source of cache tag names (ARCHITEKTURA 4.2). A public site query is
 * tagged; after a write, a Server Action calls `updateTag` with the same tag
 * (Next 16: invalidated immediately, so the author sees their change).
 */
export const tags = {
  /** Regions, countries, indicator definitions, global issues — the whole map snapshot. */
  atlas: "atlas",
  /** One indicator's values, cached apart from the snapshot (they grow with every layer and year). */
  indicator: (id: string) => `indicator:${id}`,
  /** One country's profile text, kept out of the atlas snapshot (Next skips items over 2 MB). */
  country: (iso3: string) => `country:${iso3}`,
  /** Article lists and indexes: news, topics, authors, home, search, map counts. */
  entries: "entries",
  /** One article's page — every language version of the slug. */
  entry: (slug: string) => `entry:${slug}`,
  /**
   * Every article page at once — only for the rare changes they all embed
   * (an author profile; a global issue renamed or deleted, which cascades).
   */
  entryPages: "entry-pages",
  portrait: (kind: "region" | "issue", slug: string) => `portrait:${kind}:${slug}`,
  /** Feature flags and maintenance mode. */
  flags: "flags",
  /** Redirects of old URLs (redirects table). */
  redirects: "redirects",
  /** Atlas Patrons progress (patron_stats) — payment webhook and admin grants. */
  patrons: "patrons",
} as const;

/**
 * Tags of a cached read of one article's page. Not the list tag: editing one
 * article must not throw every other article page out of the cache.
 */
export const entryPageTags = (slug: string): string[] => [tags.entry(slug), tags.entryPages];

/**
 * Tags to update after a published article changed: the lists it appears in
 * and, when known, its own page.
 */
export const entryChangedTags = (slug?: string | null): string[] =>
  slug ? [tags.entries, tags.entry(slug)] : [tags.entries];

/** Safety net: even without invalidation, public data refreshes within an hour at most. */
export const PUBLIC_REVALIDATE_SECONDS = 3600;
