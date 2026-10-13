/**
 * Kinds of place, defined once for the Zod schemas, the types and the select
 * options. No server dependency: client components use them too.
 */

/**
 * A place a topic or a portrait belongs to: a country, an Atlas region, or a
 * group of countries (`special_regions` — a global issue or a custom region).
 */
export const PLACE_KINDS = ["country", "region", "issue"] as const;
export type PlaceKind = (typeof PLACE_KINDS)[number];

/** A place with its own portrait page: an Atlas region or a group of countries. */
export type PortraitPlace = Exclude<PlaceKind, "country">;

/** What a group of countries is (`special_regions.kind`): a global issue, or a custom region. */
export const GROUP_KINDS = ["issue", "region"] as const;
export type GroupKind = (typeof GROUP_KINDS)[number];
