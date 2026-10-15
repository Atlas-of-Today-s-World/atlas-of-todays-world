import "server-only";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import generated from "@/data/countries.generated.json";
import type { Locale } from "@/features/i18n/config";
import { PUBLIC_REVALIDATE_SECONDS, tags } from "@/lib/cache/tags";
import { must } from "@/lib/db/result";
import { createPublicClient } from "@/lib/supabase/public";
import {
  buildAtlas,
  countryStats,
  indicatorData,
  type AtlasSnapshot,
  type GeoFacts,
  type IndicatorValues,
} from "./model";
import type { Atlas, CountryStat, IndicatorData } from "./types";

const PAGE = 1000; // PostgREST returns at most 1000 rows per query.

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** Loads a whole table page by page; a DB error fails the build instead of silently returning nothing. */
async function all<T>(label: string, page: (from: number, to: number) => Page<T>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const data = must(await page(from, from + PAGE - 1), `atlas: ${label}`);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

/**
 * Everything the map is drawn from, in one pass; the result goes into the Next
 * data cache as one item that every page reads. Next skips caching an item over
 * 2 MB, so what only some pages need and what grows stays out of it: long
 * per-country text (`getCountryProfileHtml`) and indicator values
 * (`getIndicator`).
 */
const loadSnapshot = unstable_cache(
  async (): Promise<AtlasSnapshot> => {
    const db = createPublicClient();
    const [
      regions,
      countries,
      countryMetrics,
      indicators,
      categories,
      issues,
      members,
      themes,
      areas,
    ] = await Promise.all([
      all("regions", (a, b) =>
        db
          .from("regions")
          .select(
            "slug, name, tagline, fill, stroke, center_lon, center_lat, zoom, summary, hero_url, hero_credit, show_metrics, content_status",
          )
          .order("position")
          .order("slug")
          .range(a, b),
      ),
      all("countries", (a, b) =>
        db
          .from("countries")
          .select(
            "iso3, slug, name, name_formal, region_slug, un_subregion, population, lon, lat, bbox, territory_note, blurb, tagline, featured_indicators",
          )
          .order("iso3")
          .range(a, b),
      ),
      all("portrait_metrics", (a, b) =>
        db
          .from("portrait_metrics")
          .select("country_iso3, value, label, description, source, source_url, year, period")
          .not("country_iso3", "is", null)
          .order("position")
          .range(a, b),
      ),
      all("indicators", (a, b) =>
        db
          .from("indicators")
          .select(
            "id, label, short_label, description, unit, decimals, source, source_url, type, scale, domain_min, domain_max, ramp, higher_is_better, latest_year",
          )
          .order("position")
          .order("id")
          .range(a, b),
      ),
      all("indicator_categories", (a, b) =>
        db
          .from("indicator_categories")
          .select("indicator_id, value, label, color")
          .order("indicator_id")
          .range(a, b),
      ),
      all("special_regions", (a, b) =>
        db
          .from("special_regions")
          .select(
            "slug, name, subtitle, summary, fill, stroke, center_lon, center_lat, zoom, hero_url, hero_credit, kind, content_status",
          )
          .order("name")
          .range(a, b),
      ),
      all("special_region_countries", (a, b) =>
        db
          .from("special_region_countries")
          .select("special_slug, country_iso3")
          .order("special_slug")
          .range(a, b),
      ),
      all("site_theme", (a, b) => db.from("site_theme").select("saturation, border").range(a, b)),
      all("map_areas", (a, b) =>
        db
          .from("map_areas")
          .select("slug, name, label, country_iso3, fill, stroke, geometry")
          .order("name")
          .range(a, b),
      ),
    ]);
    return {
      regions,
      countries,
      countryMetrics,
      indicators,
      categories,
      issues,
      issueCountries: members,
      theme: themes[0] ?? null,
      areas,
    };
  },
  ["atlas-snapshot"],
  { tags: [tags.atlas], revalidate: PUBLIC_REVALIDATE_SECONDS },
);

interface GeneratedCountry {
  iso3: string;
  iso2: string | null;
  continent: string | null;
  territoryNote: GeoFacts["territoryNote"];
}

const GEO: GeoFacts[] = (generated as GeneratedCountry[]).map(
  ({ iso3, iso2, continent, territoryNote }) => ({ iso3, iso2, continent, territoryNote }),
);

/** The atlas model, assembled once per request from the cached snapshot. */
const atlasOfRequest = cache(async (): Promise<Atlas> => buildAtlas(await loadSnapshot(), GEO));

/**
 * Atlas model for one request. It is the same in every language (the texts are
 * English, ADR-022, and indicator values, formatted per language, aren't in
 * it), so the locale the pages pass doesn't split it.
 */
export const getAtlas = (_locale?: Locale): Promise<Atlas> => atlasOfRequest();

/**
 * One indicator's values, a data cache item per indicator under its own tag:
 * only the pages that show values read them (country cards, a layer's ranking,
 * group averages, the globe layer, llms-full.txt), and saving a value refreshes
 * that one layer.
 */
function loadIndicatorValues(id: string): Promise<IndicatorValues> {
  return unstable_cache(
    async () => {
      const db = createPublicClient();
      const rows = await all(`indicator_values ${id}`, (a, b) =>
        db
          .from("indicator_values")
          .select("country_iso3, value, year")
          .eq("indicator_id", id)
          .order("country_iso3")
          .range(a, b),
      );
      const values: IndicatorValues = {};
      for (const row of rows) values[row.country_iso3] = [Number(row.value), row.year];
      return values;
    },
    ["indicator-values", id],
    { tags: [tags.indicator(id)], revalidate: PUBLIC_REVALIDATE_SECONDS },
  )();
}

/**
 * A data layer with its values, or null for an unknown id. The definition is
 * looked up first, so an unknown id never reaches the database or the cache.
 */
export const getIndicator = cache(async (id: string): Promise<IndicatorData | null> => {
  const definition = (await getAtlas()).indicatorById.get(id);
  return definition ? indicatorData(definition, await loadIndicatorValues(id)) : null;
});

/** Data layers with their values in the atlas order: those with the given ids, or all. */
export async function getIndicators(ids?: readonly string[]): Promise<IndicatorData[]> {
  const { indicators } = await getAtlas();
  const wanted = ids ? indicators.filter((indicator) => ids.includes(indicator.id)) : indicators;
  const loaded = await Promise.all(wanted.map((indicator) => getIndicator(indicator.id)));
  return loaded.filter((indicator): indicator is IndicatorData => indicator !== null);
}

/**
 * A country's value in every layer, with its year, source and rank among all
 * countries (its card, page description and JSON-LD). Ranks need every
 * country's values, so this reads all layers — only the country page does.
 */
export const getCountryStats = cache(async (iso3: string, locale: Locale): Promise<CountryStat[]> =>
  countryStats(iso3, await getIndicators(), locale),
);

/**
 * A country's editorial profile text (sanitized HTML, "" when unwritten), cached
 * per country: only its own page shows it, and saving the profile revalidates
 * `tags.country` together with the map snapshot.
 */
export function getCountryProfileHtml(iso3: string): Promise<string> {
  return unstable_cache(
    async () => {
      const row = must(
        await createPublicClient()
          .from("countries")
          .select("profile_html")
          .eq("iso3", iso3)
          .maybeSingle(),
        "atlas: country profile",
      );
      return row?.profile_html ?? "";
    },
    ["country-profile", iso3],
    { tags: [tags.country(iso3)], revalidate: PUBLIC_REVALIDATE_SECONDS },
  )();
}

/** Options for admin selects (regions, global issues, countries alphabetically). */
export async function getPickerOptions() {
  const atlas = await getAtlas();
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "en");
  return {
    regions: atlas.regions.map(({ slug, name }) => ({ slug, name })),
    issues: atlas.issues.map(({ slug, name }) => ({ slug, name })).sort(byName),
    countries: atlas.countries.map(({ iso3, name }) => ({ iso3, name })).sort(byName),
  };
}
