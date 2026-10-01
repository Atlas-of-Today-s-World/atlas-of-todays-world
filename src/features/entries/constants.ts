/** Entry constants without Zod — client editor components may import them. */

/** Max chapters per entry (the brief wants 4–6; the DB allows 8). */
export const MAX_CHAPTERS = 8;

/** Shared preview validity periods in hours (the DB allows 1 to 720). */
export const PREVIEW_HOURS = [24, 72, 168, 720] as const;
