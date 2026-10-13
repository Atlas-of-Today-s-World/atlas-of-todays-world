/**
 * How many subtopic tiles the home map shows (home_settings.featured_count,
 * DB CHECK 1–6). Shared by the admin form, its Zod schema and the public read.
 */
export const FEATURED_COUNT = { min: 1, max: 6, default: 2 } as const;

/** The count within the bounds (a missing or broken value → the default). */
export function clampFeaturedCount(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isInteger(value)) return FEATURED_COUNT.default;
  return Math.min(FEATURED_COUNT.max, Math.max(FEATURED_COUNT.min, value));
}
