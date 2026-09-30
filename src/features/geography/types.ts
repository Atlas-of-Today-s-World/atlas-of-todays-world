/**
 * Typy veřejného Atlasu — regiony, země, ukazatele a global issues, jak je
 * skládá `model.ts` z databáze. Bez závislosti na serveru, takže je smí
 * importovat i klientská komponenta.
 */
import type { MetricCard } from "@/lib/content-types";

export interface Region {
  /** Totéž co slug; drží se kvůli čitelnosti porovnání „stejný region". */
  id: string;
  /** URL segment: /region/<slug> */
  slug: string;
  name: string;
  tagline: string;
  /** Výplň zemí regionu na globusu. */
  fill: string;
  /** Obrys regionu (silnější linka po obvodu). */
  stroke: string;
  /** Kam se globus otočí, když region otevřeš: [lon, lat] a zoom. */
  center: [number, number];
  zoom: number;
  hero: string | null;
  heroCredit: string;
  /** Perex – zobrazuje se v panelu mapy i jako meta description. */
  summary: string;
  /** ISO3 zemí regionu, od nejlidnatější. */
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

/** Vysvětlení, proč hranice země vypadá tak, jak vypadá (src/data/territories.json). */
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
  /** Pořadí mezi zeměmi světa, 1 = nejlepší. Chybí u kategoriálních vrstev. */
  rank: number | null;
  rankOf: number | null;
}

/** Redakční profil země — text, podtitulek, ruční karty, výběr ukazatelů. */
export interface CountryProfile {
  summary: string;
  tagline: string;
  /** Vyčištěné HTML; vykresluje se přes <SafeHtml>. */
  html: string;
  metrics: MetricCard[];
  /** Které automatické ukazatele ukázat a v jakém pořadí; prázdné = prvních šest. */
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
  /** Výřez hlavní pevniny [minLon, minLat, maxLon, maxLat] pro zoom na zemi. */
  bbox: [number, number, number, number] | null;
  territoryNote: TerritoryNote | null;
  region: Region | null;
  stats: CountryStat[];
  profile: CountryProfile;
}

/** Vlastní celek redakce (skládá se z celých zemí). */
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
  countries: string[];
}

export interface Atlas {
  regions: Region[];
  /** Země s profilem (zařazené do regionu), od nejlidnatější. */
  countries: Country[];
  indicators: Indicator[];
  issues: GlobalIssue[];
  regionBySlug: Map<string, Region>;
  countryBySlug: Map<string, Country>;
  countryByIso3: Map<string, Country>;
  indicatorById: Map<string, Indicator>;
  issueBySlug: Map<string, GlobalIssue>;
}
