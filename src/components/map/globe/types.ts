import type { ContentStatus } from "@/features/geography/content-status";

/** ISO3 -> color for each layer, precomputed on the server. */
export interface GlobeColorSets {
  [view: string]: Record<string, string>;
}

export interface RegionLookup {
  /** ISO3 -> region slug. */
  slugByCountry: Record<string, string>;
  /** region slug -> its countries, name, map fill and content status. */
  bySlug: Record<
    string,
    { name: string; countries: string[]; fill: string; status: ContentStatus }
  >;
}
