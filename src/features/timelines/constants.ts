/** Timeline code lists and limits without Zod — the client editor may import them. */

/** Whose timeline: a region, a global issue (incl. a custom region), a country, a topic. */
export const TIMELINE_OWNERS = ["region", "issue", "country", "topic"] as const;
export type TimelineOwnerKind = (typeof TIMELINE_OWNERS)[number];

/** The DB limits (migration 20261015000050): events per timeline, sources per event. */
export const MAX_EVENTS = 60;
export const MAX_SOURCES = 20;
