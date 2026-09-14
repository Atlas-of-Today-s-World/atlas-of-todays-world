import generated from "@/data/countries.generated.json";
import { REGIONS, regionOf, type Region } from "@/data/regions";
import { INDICATORS, formatValue, type Indicator } from "@/lib/indicators";

export interface GeneratedCountry {
  iso3: string;
  iso2: string | null;
  name: string;
  nameFormal: string | null;
  slug: string;
  continent: string | null;
  unRegion: string | null;
  unSubregion: string | null;
  population: number | null;
  gdpMillionsUsd: number | null;
  labelLon: number | null;
  labelLat: number | null;
  /** Výřez hlavní pevniny [minLon, minLat, maxLon, maxLat] pro zoom na zemi. */
  bbox: [number, number, number, number] | null;
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

export interface Country extends GeneratedCountry {
  region: Region | null;
  stats: CountryStat[];
}

const RAW: GeneratedCountry[] = generated as GeneratedCountry[];

/** Ministátečky a závislá území, pro která Atlas profil nedělá. */
const HIDDEN_FROM_INDEX = new Set(["ATA", "ATF", "HMD", "BVT", "SGS", "UMI"]);

function rankWithin(indicator: Indicator, iso3: string): [number, number] | null {
  if (indicator.type === "categorical") return null;
  const entries = Object.entries(indicator.values);
  const sorted = entries.sort((a, b) =>
    indicator.higherIsBetter ? b[1].value - a[1].value : a[1].value - b[1].value,
  );
  const index = sorted.findIndex(([code]) => code === iso3);
  return index < 0 ? null : [index + 1, sorted.length];
}

function statsFor(iso3: string): CountryStat[] {
  const stats: CountryStat[] = [];
  for (const indicator of INDICATORS) {
    const entry = indicator.values[iso3];
    if (!entry) continue;
    const rank = rankWithin(indicator, iso3);
    stats.push({
      id: indicator.id,
      label: indicator.label,
      shortLabel: indicator.shortLabel,
      value: formatValue(indicator, entry.value),
      raw: entry.value,
      year: entry.year,
      source: indicator.source,
      sourceUrl: indicator.sourceUrl,
      rank: rank?.[0] ?? null,
      rankOf: rank?.[1] ?? null,
    });
  }
  return stats;
}

let cache: Country[] | null = null;

export function allCountries(): Country[] {
  if (cache) return cache;
  cache = RAW.filter((country) => !HIDDEN_FROM_INDEX.has(country.iso3)).map(
    (country) => ({
      ...country,
      region: regionOf(country.iso3),
      stats: statsFor(country.iso3),
    }),
  );
  return cache;
}

/** Země, které mají profil (jsou zařazené do některého regionu). */
export function indexableCountries(): Country[] {
  return allCountries().filter((country) => country.region !== null);
}

export function countryBySlug(slug: string): Country | null {
  return allCountries().find((country) => country.slug === slug) ?? null;
}

export function countryByIso3(iso3: string): Country | null {
  return allCountries().find((country) => country.iso3 === iso3) ?? null;
}

export function countriesOfRegion(region: Region): Country[] {
  return allCountries()
    .filter((country) => country.region?.id === region.id)
    .sort((a, b) => (b.population ?? 0) - (a.population ?? 0));
}

/**
 * ISO3 -> barva regionu. Tohle je podklad pro "Encyclopedia view" na globusu.
 */
export function regionColorMap(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const region of REGIONS) {
    for (const iso3 of region.countries) out[iso3] = region.fill;
  }
  return out;
}

export function formatPopulation(value: number | null): string {
  if (!value) return "—";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)} bn`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} m`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)} k`;
  return String(value);
}
