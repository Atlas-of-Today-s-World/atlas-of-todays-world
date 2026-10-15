import type { Locale } from "@/lib/i18n/config";
import { formatValue } from "@/features/geography/indicators";
import { contentStatus } from "./content-status";
import type {
  Atlas,
  Country,
  CountryStat,
  GlobalIssue,
  Indicator,
  IndicatorData,
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
    show_metrics?: boolean;
    content_status?: string;
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
    territory_note?: string | null;
    blurb: string | null;
    tagline: string;
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
    hero_credit?: string;
    kind: string;
    content_status?: string;
  }[];
  issueCountries: { special_slug: string; country_iso3: string }[];
  theme: { saturation: number; border: number } | null;
  areas: {
    slug: string;
    name: string;
    label: string;
    country_iso3: string | null;
    fill: string;
    stroke: string;
    geometry: unknown;
  }[];
}

/**
 * One indicator's values as the data cache keeps them, apart from the snapshot
 * (they made up most of it and grow with every layer and year): ISO3 →
 * [value, year], ordered by ISO3; a null year means the indicator's latest year.
 */
export type IndicatorValues = Record<string, [value: number, year: number | null]>;

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

/** An abbreviated word in a Natural Earth short name: "Rep.", "Herz.", "S.", "Is."… */
const ABBREVIATION = /(^|\s)\p{L}{1,5}\.(\s|$)/u;
/** Leading state forms dropped from a formal name ("Republic of South Sudan" → "South Sudan"). */
const STATE_FORM = /^(?:(?:Republic|Territory|Federation|Commonwealth|Kingdom) of (?:the )?)/;

/**
 * The name shown in headings, titles and lists. Natural Earth short names are
 * map labels ("Dem. Rep. Congo", "Bosnia and Herz."); where one is abbreviated,
 * the formal name without its state form reads better ("Democratic Republic of
 * the Congo", "Bosnia and Herzegovina"). The globe keeps the short labels.
 */
export function displayName(name: string, formal: string | null): string {
  if (!ABBREVIATION.test(name) || !formal) return name;
  const full = formal.replace(STATE_FORM, "");
  // A formal name that is itself abbreviated or annotated ("Føroyar Is. (Faeroe Is.)").
  return ABBREVIATION.test(full) || full.includes("(") ? name : full;
}

function buildIndicators(snapshot: AtlasSnapshot): Indicator[] {
  return snapshot.indicators.map((row) => {
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
    };
  });
}

/** An indicator together with its cached values; a value without a year is from its latest year. */
export function indicatorData(indicator: Indicator, cached: IndicatorValues): IndicatorData {
  const values: IndicatorData["values"] = {};
  for (const [iso3, [value, year]] of Object.entries(cached)) {
    values[iso3] = { value: Number(value), year: year ?? indicator.latestYear ?? 0 };
  }
  return { ...indicator, countryCount: Object.keys(values).length, values };
}

/** Country rank in a sequential layer (1 = best); none for a categorical one. */
function ranking(indicator: IndicatorData): Map<string, number> | null {
  if (indicator.type === "categorical") return null;
  const sorted = Object.entries(indicator.values).sort((a, b) =>
    indicator.higherIsBetter ? b[1].value - a[1].value : a[1].value - b[1].value,
  );
  return new Map(sorted.map(([iso3], index) => [iso3, index + 1]));
}

/**
 * A country's value in every layer it has data in (in layer order), formatted,
 * with its year, source and rank among all countries with a value.
 */
export function countryStats(
  iso3: string,
  indicators: IndicatorData[],
  locale: Locale = "en",
): CountryStat[] {
  const stats: CountryStat[] = [];
  for (const indicator of indicators) {
    const item = indicator.values[iso3];
    if (!item) continue;
    const ranks = ranking(indicator);
    stats.push({
      id: indicator.id,
      label: indicator.label,
      shortLabel: indicator.shortLabel,
      value: formatValue(indicator, item.value, locale),
      raw: item.value,
      year: item.year,
      source: indicator.source,
      sourceUrl: indicator.sourceUrl,
      rank: ranks?.get(iso3) ?? null,
      rankOf: ranks ? ranks.size : null,
    });
  }
  return stats;
}

/**
 * The status note on a country's profile. The text the editors keep in the
 * database (countries.territory_note, editable in the admin) wins; it already
 * names its basis. The status itself (disputed, occupied…) comes with the map
 * data, because it follows how the border is drawn. Without an edited text the
 * note from the map data stays.
 */
export function territoryNote(
  fact: TerritoryNote | null,
  edited: string | null,
): Country["territoryNote"] {
  const text = edited?.trim();
  if (!text) return fact;
  return { status: fact?.status ?? null, note: text, basis: null };
}

/**
 * The placeholder every region got from the old site. Migration
 * 20261013000300 clears it in the database; until that has run in every
 * environment (atlas-dev, a fresh seed) the model drops it too, so a portrait
 * never shows it under the name. Exact match, like the migration.
 */
const PLACEHOLDER_TAGLINE = "A Comprehensive Portrait with global perspective";

/** A region's tagline as the site shows it: empty for the old placeholder. */
export function regionTagline(tagline: string): string {
  return tagline === PLACEHOLDER_TAGLINE ? "" : tagline;
}

const byPopulation = (a: { population: number | null }, b: { population: number | null }) =>
  (b.population ?? 0) - (a.population ?? 0);

export function buildAtlas(snapshot: AtlasSnapshot, geo: GeoFacts[]): Atlas {
  const indicators = buildIndicators(snapshot);
  const facts = new Map(geo.map((item) => [item.iso3, item]));

  const sortedCountries = [...snapshot.countries]
    .map((row) => ({ ...row, population: num(row.population) }))
    .sort(byPopulation);

  const regions: Region[] = snapshot.regions.map((row) => ({
    id: row.slug,
    slug: row.slug,
    name: row.name,
    tagline: regionTagline(row.tagline),
    fill: row.fill,
    stroke: row.stroke,
    center: [Number(row.center_lon), Number(row.center_lat)],
    zoom: Number(row.zoom),
    hero: row.hero_url,
    heroCredit: row.hero_credit,
    showMetrics: row.show_metrics ?? true,
    contentStatus: contentStatus(row.content_status),
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
        name: displayName(row.name, row.name_formal),
        nameFormal: row.name_formal,
        continent: fact?.continent ?? null,
        unSubregion: row.un_subregion,
        population: row.population,
        labelLon: num(row.lon),
        labelLat: num(row.lat),
        bbox,
        territoryNote: territoryNote(fact?.territoryNote ?? null, row.territory_note ?? null),
        region: regionBySlug.get(row.region_slug ?? "") ?? null,
        profile: {
          summary: row.blurb ?? "",
          tagline: row.tagline,
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
    heroCredit: row.hero_credit ?? "",
    kind: row.kind === "region" ? "region" : "issue",
    contentStatus: contentStatus(row.content_status),
    countries: members.get(row.slug) ?? [],
  }));

  return {
    regions,
    countries,
    indicators,
    issues,
    areas: snapshot.areas.map(({ country_iso3, ...area }) => ({
      ...area,
      countryIso3: country_iso3,
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
