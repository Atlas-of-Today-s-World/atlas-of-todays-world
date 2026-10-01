import "server-only";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import generated from "@/data/countries.generated.json";
import { DEFAULT_LOCALE, type Locale } from "@/features/i18n/config";
import { localizeSnapshot, type TranslationRow } from "@/features/i18n/translatable";
import { PUBLIC_REVALIDATE_SECONDS, tags } from "@/lib/cache/tags";
import { createPublicClient } from "@/lib/supabase/public";
import { buildAtlas, type AtlasSnapshot, type GeoFacts } from "./model";
import type { Atlas } from "./types";

const PAGE = 1000; // PostgREST vrací nejvýš 1000 řádků na dotaz.

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** Načte celou tabulku po stránkách; chyba DB shodí build, ne tiché prázdno. */
async function all<T>(label: string, page: (from: number, to: number) => Page<T>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(`[atlas] ${label}: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

/** Všechno, z čeho se kreslí mapa, jedním během; výsledek v datové cache Next. */
const loadSnapshot = unstable_cache(
  async (): Promise<AtlasSnapshot> => {
    const db = createPublicClient();
    const [
      regions,
      countries,
      countryMetrics,
      indicators,
      categories,
      values,
      issues,
      members,
      themes,
      areas,
    ] = await Promise.all([
      all("regions", (a, b) =>
        db
          .from("regions")
          .select(
            "slug, name, tagline, fill, stroke, center_lon, center_lat, zoom, summary, hero_url, hero_credit",
          )
          .order("position")
          .range(a, b),
      ),
      all("countries", (a, b) =>
        db
          .from("countries")
          .select(
            "iso3, slug, name, name_formal, region_slug, un_subregion, population, lon, lat, bbox, blurb, tagline, profile_html, featured_indicators",
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
      all("indicator_values", (a, b) =>
        db
          .from("indicator_values")
          .select("indicator_id, country_iso3, value, year")
          .order("indicator_id")
          .order("country_iso3")
          .range(a, b),
      ),
      all("special_regions", (a, b) =>
        db
          .from("special_regions")
          .select(
            "slug, name, subtitle, summary, fill, stroke, center_lon, center_lat, zoom, hero_url, kind",
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
          .select("slug, name, label, note, fill, stroke, geometry")
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
      values,
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

/** Překlady textů do jednoho jazyka (G5); obnovují se se stejným tagem jako Atlas. */
const loadTranslations = unstable_cache(
  async (locale: string): Promise<TranslationRow[]> => {
    const db = createPublicClient();
    return all("translations", (a, b) =>
      db
        .from("translations")
        .select("entity, entity_key, field, value")
        .eq("locale", locale)
        .order("entity")
        .order("entity_key")
        .order("field")
        .range(a, b),
    );
  },
  ["atlas-translations"],
  { tags: [tags.atlas], revalidate: PUBLIC_REVALIDATE_SECONDS },
);

/**
 * Model Atlasu pro jeden request a jazyk (snapshot je v cache, skládání jen
 * jednou). Nepřeložené texty zůstávají anglicky.
 */
export const getAtlas = cache(async (locale: Locale = DEFAULT_LOCALE): Promise<Atlas> => {
  const snapshot = await loadSnapshot();
  if (locale === DEFAULT_LOCALE) return buildAtlas(snapshot, GEO);
  return buildAtlas(localizeSnapshot(snapshot, await loadTranslations(locale)), GEO, locale);
});

/** Volby pro výběry v administraci (regiony, global issues, země podle abecedy). */
export async function getPickerOptions() {
  const atlas = await getAtlas();
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "en");
  return {
    regions: atlas.regions.map(({ slug, name }) => ({ slug, name })),
    issues: atlas.issues.map(({ slug, name }) => ({ slug, name })).sort(byName),
    countries: atlas.countries.map(({ iso3, name }) => ({ iso3, name })).sort(byName),
  };
}
