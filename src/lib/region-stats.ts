import type { Region } from "@/data/regions";
import { countriesOfRegion, type Country } from "@/lib/countries";
import { getIndicator, formatValue } from "@/lib/indicators";

/**
 * Klíčové ukazatele portrétu regionu i global issue.
 *
 * Zadání chce šest karet s citací zdroje. Tady se počítají z dat, která už
 * v Atlasu jsou (Our World in Data), takže je má i region, ke kterému redakce
 * zatím nenapsala řádek – portrét pak není prázdná skořápka.
 *
 * Číselné ukazatele se průměrují vážené počtem obyvatel: region není součet
 * států, ale součet lidí, kteří v nich žijí. U kategoriálních (politický režim)
 * dává průměr nesmysl, takže se ukazuje nejčastější kategorie.
 */

/** Šest ukazatelů na kartách, v pořadí, v jakém se kreslí. */
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
  /** Připravená hodnota k vypsání. */
  value: string;
  /** Kolik zemí regionu má data a kolik jich region má celkem. */
  coverage: { have: number; total: number };
  /** Nejnovější rok, ze kterého data pocházejí. */
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
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/** Ukazatele spočítané nad libovolnou skupinou zemí (region, global issue). */
export function groupStats(countries: Country[]): RegionStat[] {
  const out: RegionStat[] = [];

  for (const id of CARD_INDICATORS) {
    const indicator = getIndicator(id);
    if (!indicator) continue;

    // Zemi a její hodnotu držíme spolu – po odfiltrování zemí bez dat by
    // samotný index do původního pole ukazoval jinam a váhy by se rozjely.
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
      value: formatValue(indicator, raw),
      coverage: { have: rows.length, total: countries.length },
      year: Math.max(...rows.map((row) => row.stat.year)),
      source: indicator.source,
      sourceUrl: indicator.sourceUrl,
    });
  }

  return out;
}

export function regionStats(region: Region): RegionStat[] {
  return groupStats(countriesOfRegion(region));
}

/** Souhrn, který se vypisuje nad kartami. */
export function population(countries: Country[]): number {
  return countries.reduce((sum, country) => sum + (country.population ?? 0), 0);
}

export function formatPopulation(value: number): string {
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)} bn`;
  if (value >= 1e6) return `${Math.round(value / 1e6)} m`;
  return value.toLocaleString("en-GB");
}
