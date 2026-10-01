import type { Country, Indicator } from "@/features/geography/types";
import type { Locale } from "@/features/i18n/config";
import { formatValue } from "@/lib/indicators";

/**
 * Key indicators for the region portrait and global issue.
 *
 * The brief wants six cards with a source citation. Here they are computed from
 * data already in the Atlas (Our World in Data), so even a region the editors
 * haven't written a line about yet has them – the portrait isn't an empty shell.
 *
 * Numeric indicators are averaged weighted by population: a region is not a sum
 * of states but of the people living in them. For categorical ones (political
 * regime) an average is meaningless, so the most common category is shown.
 */

/** Six indicators on the cards, in drawing order. */
const CARD_INDICATORS = [
  "hdi",
  "life-expectancy",
  "gdp-per-capita",
  "political-regime",
  "corruption",
  "internet-users",
] as const;

export interface RegionStat {
  id: string;
  label: string;
  shortLabel: string;
  /** Prepared value for display. */
  value: string;
  /** How many of the region's countries have data, and how many it has in total. */
  coverage: { have: number; total: number };
  /** Latest year the data comes from. */
  year: number | null;
  source: string;
  sourceUrl: string;
}

function weightedMean(rows: { value: number; weight: number }[]): number {
  const weight = rows.reduce((sum, row) => sum + row.weight, 0);
  if (!weight) {
    return rows.reduce((sum, row) => sum + row.value, 0) / rows.length;
  }
  return rows.reduce((sum, row) => sum + row.value * row.weight, 0) / weight;
}

function mostCommon(values: number[]): number {
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
}

/** Indicators computed over any group of countries (region, global issue). */
export function groupStats(
  countries: Country[],
  indicators: Map<string, Indicator>,
  locale: Locale = "en",
): RegionStat[] {
  const out: RegionStat[] = [];

  for (const id of CARD_INDICATORS) {
    const indicator = indicators.get(id);
    if (!indicator) continue;

    // Keep the country and its value together – after filtering out countries without
    // data, a bare index into the original array would point elsewhere and weights drift.
    const rows = countries
      .map((country) => ({
        stat: country.stats.find((stat) => stat.id === id),
        weight: country.population ?? 0,
      }))
      .filter((row): row is { stat: NonNullable<typeof row.stat>; weight: number } =>
        Boolean(row.stat),
      );
    if (!rows.length) continue;

    const raw =
      indicator.type === "categorical"
        ? mostCommon(rows.map((row) => row.stat.raw))
        : weightedMean(rows.map((row) => ({ value: row.stat.raw, weight: row.weight })));

    out.push({
      id,
      label: indicator.label,
      shortLabel: indicator.shortLabel,
      value: formatValue(indicator, raw, locale),
      coverage: { have: rows.length, total: countries.length },
      year: Math.max(...rows.map((row) => row.stat.year)),
      source: indicator.source,
      sourceUrl: indicator.sourceUrl,
    });
  }

  return out;
}

/** Summary shown above the cards. */
export function population(countries: Country[]): number {
  return countries.reduce((sum, country) => sum + (country.population ?? 0), 0);
}
