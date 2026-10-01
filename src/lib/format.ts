import type { Locale } from "@/features/i18n/config";

const INTL: Record<Locale, string> = { en: "en-US", cs: "cs-CZ" };
const DATE_INTL: Record<Locale, string> = { en: "en-GB", cs: "cs-CZ" };

/** Číslo s pevným počtem desetinných míst v zápisu jazyka (0.92 / 0,92). */
export function formatNumber(value: number, decimals: number, locale: Locale = "en"): string {
  return new Intl.NumberFormat(INTL[locale], {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

const POPULATION_UNITS: Record<Locale, [string, string, string]> = {
  en: ["bn", "m", "k"],
  cs: ["mld.", "mil.", "tis."],
};

/** Počet obyvatel pro kartu země i portrét („1.43 bn", „38.0 m" / „38,0 mil."). */
export function formatPopulation(value: number | null, locale: Locale = "en"): string {
  if (!value) return "—";
  const [bn, m, k] = POPULATION_UNITS[locale];
  if (value >= 1_000_000_000) return `${formatNumber(value / 1_000_000_000, 2, locale)} ${bn}`;
  if (value >= 1_000_000) return `${formatNumber(value / 1_000_000, 1, locale)} ${m}`;
  if (value >= 1_000) return `${formatNumber(value / 1_000, 0, locale)} ${k}`;
  return String(value);
}

/** Datum v článku („3 October 2026" / „3. října 2026"). */
export function formatLongDate(isoDate: string, locale: Locale = "en"): string {
  return new Date(isoDate).toLocaleDateString(DATE_INTL[locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
