import type { Locale } from "@/features/i18n/config";

const INTL: Record<Locale, string> = { en: "en-US", cs: "cs-CZ" };
export const DATE_INTL: Record<Locale, string> = { en: "en-GB", cs: "cs-CZ" };

/** Number with a fixed number of decimals in the language's notation (0.92 / 0,92). */
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

/** Population for the country card and portrait ("1.43 bn", "38.0 m" / "38,0 mil."). */
export function formatPopulation(value: number | null, locale: Locale = "en"): string {
  if (!value) return "—";
  const [bn, m, k] = POPULATION_UNITS[locale];
  if (value >= 1_000_000_000) return `${formatNumber(value / 1_000_000_000, 2, locale)} ${bn}`;
  if (value >= 1_000_000) return `${formatNumber(value / 1_000_000, 1, locale)} ${m}`;
  if (value >= 1_000) return `${formatNumber(value / 1_000, 0, locale)} ${k}`;
  return String(value);
}

/** Article date ("3 October 2026" / "3. října 2026"). */
export function formatLongDate(isoDate: string, locale: Locale = "en"): string {
  return new Date(isoDate).toLocaleDateString(DATE_INTL[locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Whole-euro amount in the locale's notation ("€10,000" / "10 000 €"). */
export function formatEuro(value: number, locale: Locale = "en"): string {
  return new Intl.NumberFormat(INTL[locale], {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Whole percent in the locale's notation ("42%" / "42 %"). */
export function formatPercent(percent: number, locale: Locale = "en"): string {
  return new Intl.NumberFormat(INTL[locale], { style: "percent" }).format(percent / 100);
}
