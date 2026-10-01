/**
 * Single source of cache tag names (ARCHITEKTURA 4.2). A public site query is
 * tagged; after a write, a Server Action calls `updateTag` with the same tag
 * (Next 16: invalidated immediately, so the author sees their change).
 */
export const tags = {
  /** Regions, countries, indicators, global issues — the whole map snapshot. */
  atlas: "atlas",
  entries: "entries",
  entry: (slug: string) => `entry:${slug}`,
  portrait: (kind: "region" | "issue", slug: string) => `portrait:${kind}:${slug}`,
  /** Feature flags and maintenance mode. */
  flags: "flags",
  /** Redirects of old URLs (redirects table). */
  redirects: "redirects",
  /** Atlas Patrons progress (patron_stats) — payment webhook and admin grants. */
  patrons: "patrons",
} as const;

/** Safety net: even without invalidation, public data refreshes within an hour at most. */
export const PUBLIC_REVALIDATE_SECONDS = 3600;
