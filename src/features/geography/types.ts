/**
 * Public Atlas types — regions, countries, indicators and global issues as
 * `model.ts` assembles them from the database. No server dependency, so a
 * client component may import them too.
 */
import type { MetricCard } from "@/lib/content-types";

export interface Region {
  /** Same as slug; kept for readability of "same region" comparisons. */
  id: string;
  /** URL segment: /region/<slug> */
  slug: string;
  name: string;
  tagline: string;
  /** Fill of the region's countries on the globe. */
  fill: string;
  /** Region outline (thicker line along the perimeter). */
  stroke: string;
  /** Where the globe turns when you open the region: [lon, lat] and zoom. */
  center: [number, number];
  zoom: number;
  hero: string | null;
  heroCredit: string;
  /** Lead – shown in the map panel and as the meta description. */
  summary: string;
  /** ISO3 codes of the region's countries, most populous first. */
  countries: string[];
}

interface IndicatorCategory {
  value: number;
  label: string;
  color: string;
}

export interface Indicator {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  unit: string;
  decimals: number;
  source: string;
  sourceUrl: string;
  type: "sequential" | "categorical";
  scale?: "log";
  domain?: [number, number];
  ramp?: string[];
  categories?: IndicatorCategory[];
  higherIsBetter: boolean;
  latestYear: number | null;
  countryCount: number;
  values: Record<string, { value: number; year: number }>;
}

/** Explanation of why a country's border looks the way it does (src/data/territories.json). */
export interface TerritoryNote {
  status: "disputed" | "non-self-governing" | "occupied";
  note: string;
  basis: string;
}

export interface CountryStat {
  id: string;
  label: string;
  shortLabel: string;
  value: string;
  raw: number;
  year: number;
  source: string;
  sourceUrl: string;
  /** Rank among the world's countries, 1 = best. Missing for categorical layers. */
  rank: number | null;
  rankOf: number | null;
}

/** Editorial country profile — text, subtitle, manual cards, indicator selection. */
export interface CountryProfile {
  summary: string;
  tagline: string;
  /** Sanitized HTML; rendered via <SafeHtml>. */
  html: string;
  metrics: MetricCard[];
  /** Which automatic indicators to show and in what order; empty = the first six. */
  featured: string[];
}

export interface Country {
  iso3: string;
  iso2: string | null;
  slug: string;
  name: string;
  nameFormal: string | null;
  continent: string | null;
  unSubregion: string | null;
  population: number | null;
  labelLon: number | null;
  labelLat: number | null;
  /** Mainland bounding box [minLon, minLat, maxLon, maxLat] for zooming to the country. */
  bbox: [number, number, number, number] | null;
  territoryNote: TerritoryNote | null;
  region: Region | null;
  stats: CountryStat[];
  profile: CountryProfile;
}

/** Custom editorial unit (composed of whole countries). */
export interface GlobalIssue {
  slug: string;
  name: string;
  subtitle: string;
  summary: string;
  fill: string;
  stroke: string;
  center: [number, number];
  zoom: number;
  hero: string | null;
  /** Global issue (war, migration…), or a custom region made of countries. */
  kind: "issue" | "region";
  countries: string[];
}

/** Custom area on the map (GeoJSON Polygon from the admin). */
export interface MapArea {
  slug: string;
  name: string;
  label: string;
  note: string;
  fill: string;
  stroke: string;
  geometry: { type: "Polygon"; coordinates: number[][][] };
}

/** Vzhled mapy ze site_theme. */
interface MapTheme {
  /** Multiplier of layer colour saturation (1 = unchanged). */
  saturation: number;
  /** Multiplier of border width (1 = unchanged). */
  border: number;
}

export interface Atlas {
  regions: Region[];
  /** Countries with a profile (assigned to a region), most populous first. */
  countries: Country[];
  indicators: Indicator[];
  issues: GlobalIssue[];
  areas: MapArea[];
  theme: MapTheme;
  regionBySlug: Map<string, Region>;
  countryBySlug: Map<string, Country>;
  countryByIso3: Map<string, Country>;
  indicatorById: Map<string, Indicator>;
  issueBySlug: Map<string, GlobalIssue>;
}
