import "server-only";
import { DEFAULT_LOCALE, isLocale, LOCALES, type Locale } from "@/lib/i18n/config";
import type { NewsCategory } from "@/lib/content-types";
import type { EntrySummary } from "./types";

/**
 * Row shape and mapping shared by the public article reads (`queries.ts`,
 * `topic-queries.ts`, `preview-queries.ts`).
 */

// Anon may read only the listed columns (DB-08) — never select *.
export const BASE_COLUMNS =
  "slug, locale, title, summary, category, region_slug, special_slug, cover_url, cover_credit, author_name, published_on, updated_at, reading_minutes, entry_countries(country_iso3)";
export const COLUMNS = `${BASE_COLUMNS}, authors(slug, name)`;
/** Columns of a "Learn more" tile (a topic's own or a template's), without its position. */
export const TILE_COLUMNS =
  "id, slug, label, description, icon, image_url, image_credit, background";

export interface Row {
  slug: string;
  locale: string;
  title: string;
  summary: string;
  category: string;
  region_slug: string | null;
  special_slug: string | null;
  cover_url: string | null;
  cover_credit: string | null;
  author_name: string | null;
  published_on: string | null;
  updated_at: string;
  reading_minutes: number | null;
  entry_countries: { country_iso3: string }[];
  /** Author profile (byline with a public page); null for free-text bylines. */
  authors: { slug: string; name: string } | null;
}

export function toSummary(row: Row, languages: Locale[] = [DEFAULT_LOCALE]): EntrySummary {
  return {
    languages,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    category: row.category as NewsCategory,
    region: row.region_slug,
    issue: row.special_slug,
    countries: row.entry_countries.map((item) => item.country_iso3),
    hero: row.cover_url ?? undefined,
    heroCredit: row.cover_credit ?? undefined,
    // The profile's name takes precedence over the article's free text.
    author: row.authors?.name ?? row.author_name ?? undefined,
    authorSlug: row.authors?.slug,
    published: row.published_on ?? undefined,
    updated: row.updated_at.slice(0, 10),
    readingMinutes: row.reading_minutes ?? undefined,
  };
}

export const toLocale = (value: string): Locale => (isLocale(value) ? value : DEFAULT_LOCALE);

/**
 * From the published language versions of the same slug, picks the one in the
 * page language, otherwise the original. Also returns the list of available languages.
 */
export function pickVersion<R extends Row & { translation_of: string | null }>(
  rows: R[],
  locale: Locale,
) {
  const original = rows.find((row) => row.translation_of === null);
  const row = rows.find((item) => item.locale === locale) ?? original ?? rows[0];
  if (!row) return null;
  const languages = LOCALES.filter((code) => rows.some((item) => item.locale === code));
  return { row, languages, locale: toLocale(row.locale) };
}
