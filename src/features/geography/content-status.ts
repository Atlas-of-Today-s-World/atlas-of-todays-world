/**
 * How far the editors are with a place's content. The site raises money per
 * region, so the globe and the portrait say plainly what is done and what still
 * waits for support. No server dependency: the globe (a client component) uses
 * it too.
 *
 * - global issues (`special_regions.content_status`): not started, in
 *   preparation or ready;
 * - regions (`regions.content_progress`, owner's decision of 2026-10-17): planned
 *   for the future or completed — one button in the admin flips it.
 */

export const CONTENT_STATUSES = ["none", "preparing", "ready"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const REGION_PROGRESS = ["planned", "completed"] as const;
export type RegionProgress = (typeof REGION_PROGRESS)[number];

/** A region's or a global issue's status, where the globe and the portrait show both. */
export type GroupStatus = ContentStatus | RegionProgress;

/** A database value → a known status; anything unexpected reads as not started. */
export function contentStatus(value: unknown): ContentStatus {
  return CONTENT_STATUSES.find((status) => status === value) ?? "none";
}

/** A database value → a region's progress; anything unexpected reads as planned. */
export function regionProgress(value: unknown): RegionProgress {
  return value === "completed" ? "completed" : "planned";
}

/** Nobody has written the place's content yet: grey on the globe, a call for support. */
function notStarted(status: GroupStatus): boolean {
  return status === "none" || status === "planned";
}

/**
 * Countries nobody has started on: every group they belong to is still not
 * started. A country in a done group stays lit even when another of its groups
 * is untouched (Ukraine in a finished war issue and an empty climate one).
 */
export function unprocessedCountries(
  groups: readonly { countries: readonly string[]; status: GroupStatus }[],
): string[] {
  const started = new Set<string>();
  const all = new Set<string>();
  for (const group of groups) {
    for (const iso3 of group.countries) {
      all.add(iso3);
      if (!notStarted(group.status)) started.add(iso3);
    }
  }
  return [...all].filter((iso3) => !started.has(iso3)).sort();
}
