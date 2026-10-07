/**
 * How far the editors are with a region's or global issue's content
 * (`regions.content_status`, `special_regions.content_status`). The site raises
 * money per region, so the globe and the portrait say plainly what is done,
 * what is being written and what still waits for support. No server
 * dependency: the globe (a client component) uses it too.
 */

export const CONTENT_STATUSES = ["none", "preparing", "ready"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

/** A database value → a known status; anything unexpected reads as not started. */
export function contentStatus(value: unknown): ContentStatus {
  return CONTENT_STATUSES.find((status) => status === value) ?? "none";
}

/**
 * Countries nobody has started on: every group they belong to is still `none`.
 * A country in a ready group stays lit even when another of its groups is
 * untouched (Ukraine in a finished war issue and an empty climate one).
 */
export function unprocessedCountries(
  groups: readonly { countries: readonly string[]; status: ContentStatus }[],
): string[] {
  const started = new Set<string>();
  const all = new Set<string>();
  for (const group of groups) {
    for (const iso3 of group.countries) {
      all.add(iso3);
      if (group.status !== "none") started.add(iso3);
    }
  }
  return [...all].filter((iso3) => !started.has(iso3)).sort();
}
