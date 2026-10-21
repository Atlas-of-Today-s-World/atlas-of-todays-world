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
