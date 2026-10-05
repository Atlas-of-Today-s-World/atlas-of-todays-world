import type { Locale } from "@/features/i18n/config";
import { formatValue } from "@/lib/indicators";
import type {
  Atlas,
  Country,
  CountryStat,
  GlobalIssue,
  Indicator,
  MapArea,
  Region,
  TerritoryNote,
} from "./types";

/**
 * Builds the Atlas model the pages work with from database rows. Pure
 * functions without I/O — queries live in `queries.ts`, so everything here is testable.
 */

export interface AtlasSnapshot {
  regions: {
    slug: string;
    name: string;
    tagline: string;
    fill: string;
    stroke: string;
    center_lon: number;
    center_lat: number;
    zoom: number;
    summary: string;
    hero_url: string | null;
    hero_credit: string;
  }[];
  countries: {
    iso3: string;
    slug: string;
    name: string;
    name_formal: string | null;
    region_slug: string | null;
    un_subregion: string | null;
    population: number | null;
    lon: number | null;
    lat: number | null;
    bbox: number[] | null;
    blurb: string | null;
    tagline: string;
    profile_html: string;
    featured_indicators: string[];
  }[];
  countryMetrics: {
    country_iso3: string | null;
    value: string;
    label: string;
    description: string;
    source: string;
    source_url: string | null;
    year: number | null;
    period: string | null;
  }[];
  indicators: {
    id: string;
    label: string;
    short_label: string;
    description: string;
    unit: string;
    decimals: number;
    source: string;
    source_url: string | null;
    type: string;
    scale: string;
    domain_min: number | null;
    domain_max: number | null;
    ramp: string[];
    higher_is_better: boolean;
    latest_year: number | null;
  }[];
  categories: { indicator_id: string; value: number; label: string; color: string }[];
  values: { indicator_id: string; country_iso3: string; value: number; year: number | null }[];
  issues: {
    slug: string;
    name: string;
    subtitle: string;
    summary: string;
    fill: string;
    stroke: string;
    center_lon: number;
    center_lat: number;
    zoom: number;
    hero_url: string | null;
    kind: string;
  }[];
  issueCountries: { special_slug: string; country_iso3: string }[];
  theme: { saturation: number; border: number } | null;
  areas: {
    slug: string;
    name: string;
    label: string;
    note: string;
    fill: string;
    stroke: string;
    geometry: unknown;
  }[];
}

/** Geographic facts from Natural Earth that aren't edited in the admin (src/data). */
export interface GeoFacts {
  iso3: string;
  iso2: string | null;
  continent: string | null;
  territoryNote: TerritoryNote | null;
}

/** Microstates and dependent territories for which the Atlas has no profile. */
const HIDDEN_FROM_INDEX = new Set(["ATA", "ATF", "HMD", "BVT", "SGS", "UMI"]);

const num = (value: number | string | null) => (value === null ? null : Number(value));

function buildIndicators(snapshot: AtlasSnapshot): Indicator[] {
  return snapshot.indicators.map((row) => {
    const values: Indicator["values"] = {};
    for (const value of snapshot.values) {
      if (value.indicator_id !== row.id) continue;
      values[value.country_iso3] = {
        value: Number(value.value),
        year: value.year ?? row.latest_year ?? 0,
      };
    }
    const categories = snapshot.categories
      .filter((category) => category.indicator_id === row.id)
      .map(({ value, label, color }) => ({ value, label, color }))
      .sort((a, b) => a.value - b.value);
    const min = num(row.domain_min);
    const max = num(row.domain_max);
    return {
      id: row.id,
      label: row.label,
      shortLabel: row.short_label || row.label,
      description: row.description,
      unit: row.unit,
      decimals: row.decimals,
      source: row.source,
      sourceUrl: row.source_url ?? "",
      type: row.type === "categorical" ? "categorical" : "sequential",
      scale: row.scale === "log" ? "log" : undefined,
      domain: min !== null && max !== null ? [min, max] : undefined,
      ramp: row.ramp.length ? row.ramp : undefined,
      categories: categories.length ? categories : undefined,
      higherIsBetter: row.higher_is_better,
      latestYear: row.latest_year,
      countryCount: Object.keys(values).length,
      values,
    };
  });
}

/** Country rank in each sequential layer (1 = best), computed once. */
function rankings(indicators: Indicator[]): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const indicator of indicators) {
    if (indicator.type === "categorical") continue;
    const sorted = Object.entries(indicator.values).sort((a, b) =>
      indicator.higherIsBetter ? b[1].value - a[1].value : a[1].value - b[1].value,
    );
    out.set(indicator.id, new Map(sorted.map(([iso3], index) => [iso3, index + 1])));
  }
  return out;
}

function statsFor(
  iso3: string,
  indicators: Indicator[],
  ranks: Map<string, Map<string, number>>,
  locale: Locale,
): CountryStat[] {
  const stats: CountryStat[] = [];
  for (const indicator of indicators) {
    const item = indicator.values[iso3];
    if (!item) continue;
    const ranking = ranks.get(indicator.id);
    stats.push({
      id: indicator.id,
      label: indicator.label,
      shortLabel: indicator.shortLabel,
      value: formatValue(indicator, item.value, locale),
      raw: item.value,
      year: item.year,
      source: indicator.source,
      sourceUrl: indicator.sourceUrl,
      rank: ranking?.get(iso3) ?? null,
      rankOf: ranking ? ranking.size : null,
    });
  }
  return stats;
}

const byPopulation = (a: { population: number | null }, b: { population: number | null }) =>
  (b.population ?? 0) - (a.population ?? 0);

export function buildAtlas(snapshot: AtlasSnapshot, geo: GeoFacts[], locale: Locale = "en"): Atlas {
  const indicators = buildIndicators(snapshot);
  const ranks = rankings(indicators);
  const facts = new Map(geo.map((item) => [item.iso3, item]));

  const sortedCountries = [...snapshot.countries]
    .map((row) => ({ ...row, population: num(row.population) }))
    .sort(byPopulation);

  const regions: Region[] = snapshot.regions.map((row) => ({
    id: row.slug,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    fill: row.fill,
    stroke: row.stroke,
    center: [Number(row.center_lon), Number(row.center_lat)],
    zoom: Number(row.zoom),
    hero: row.hero_url,
    heroCredit: row.hero_credit,
    summary: row.summary,
    countries: sortedCountries
      .filter((country) => country.region_slug === row.slug)
      .map((country) => country.iso3),
  }));
  const regionBySlug = new Map(regions.map((region) => [region.slug, region]));

  const countries: Country[] = sortedCountries
    .filter((row) => row.region_slug && !HIDDEN_FROM_INDEX.has(row.iso3))
    .map((row) => {
      const fact = facts.get(row.iso3);
      const bbox = row.bbox?.length === 4 ? (row.bbox.map(Number) as Country["bbox"]) : null;
      return {
        iso3: row.iso3,
        iso2: fact?.iso2 ?? null,
        slug: row.slug,
        name: row.name,
        nameFormal: row.name_formal,
        continent: fact?.continent ?? null,
        unSubregion: row.un_subregion,
        population: row.population,
        labelLon: num(row.lon),
        labelLat: num(row.lat),
        bbox,
        territoryNote: fact?.territoryNote ?? null,
        region: regionBySlug.get(row.region_slug ?? "") ?? null,
        stats: statsFor(row.iso3, indicators, ranks, locale),
        profile: {
          summary: row.blurb ?? "",
          tagline: row.tagline,
          html: row.profile_html,
          featured: row.featured_indicators,
          metrics: snapshot.countryMetrics
            .filter((metric) => metric.country_iso3 === row.iso3)
            .map((metric) => ({
              value: metric.value,
              label: metric.label,
              description: metric.description || undefined,
              source: metric.source,
              sourceUrl: metric.source_url ?? undefined,
              year: metric.period ?? (metric.year ? String(metric.year) : undefined),
            })),
        },
      };
    });

  const members = new Map<string, string[]>();
  for (const row of snapshot.issueCountries) {
    members.set(row.special_slug, [...(members.get(row.special_slug) ?? []), row.country_iso3]);
  }
  const issues: GlobalIssue[] = snapshot.issues.map((row) => ({
    slug: row.slug,
    name: row.name,
    subtitle: row.subtitle,
    summary: row.summary,
    fill: row.fill,
    stroke: row.stroke,
    center: [Number(row.center_lon), Number(row.center_lat)],
    zoom: Number(row.zoom),
    hero: row.hero_url,
    kind: row.kind === "region" ? "region" : "issue",
    countries: members.get(row.slug) ?? [],
  }));

  return {
    regions,
    countries,
    indicators,
    issues,
    areas: snapshot.areas.map((area) => ({
      ...area,
      geometry: area.geometry as MapArea["geometry"],
    })),
    theme: {
      saturation: Number(snapshot.theme?.saturation ?? 1),
      border: Number(snapshot.theme?.border ?? 1),
    },
    regionBySlug,
    countryBySlug: new Map(countries.map((country) => [country.slug, country])),
    countryByIso3: new Map(countries.map((country) => [country.iso3, country])),
    indicatorById: new Map(indicators.map((indicator) => [indicator.id, indicator])),
    issueBySlug: new Map(issues.map((issue) => [issue.slug, issue])),
  };
}

/** Countries from the ISO3 list that have a profile, most populous first. */
export function countriesOf(atlas: Atlas, iso3s: string[]): Country[] {
  return iso3s
    .map((iso3) => atlas.countryByIso3.get(iso3))
    .filter((country): country is Country => Boolean(country))
    .sort(byPopulation);
}

/** ISO3 -> region colour: the base for the default "World metrics" view on the globe. */
export function regionColorMap(regions: Region[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const region of regions) for (const iso3 of region.countries) out[iso3] = region.fill;
  return out;
}
