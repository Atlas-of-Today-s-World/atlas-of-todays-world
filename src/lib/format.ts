import type { Locale } from "@/lib/i18n/config";

/**
 * Number and date formatting in the page language — the one place for
 * Intl formats, so every number on the site reads the same.
 */

const INTL: Record<Locale, string> = { en: "en-US" };
export const DATE_INTL: Record<Locale, string> = { en: "en-GB" };

/** Number with a fixed number of decimals in the language's notation (0.92). */
export function formatNumber(value: number, decimals: number, locale: Locale = "en"): string {
  return new Intl.NumberFormat(INTL[locale], {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

const POPULATION_UNITS: Record<Locale, [string, string, string]> = {
  en: ["bn", "m", "k"],
};

/** Population for the country card and portrait ("1.43 bn", "38.0 m"). */
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

/** The admin is in English; dates in the unambiguous British order. */
const DATE_TIME = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

/** Admin date and time ("1 Oct 2026, 14:05"), in the time zone of whoever renders it. */
export function formatDateTime(value: string | number | Date): string {
  return DATE_TIME.format(new Date(value));
}

/** The UTC calendar day as YYYY-MM-DD (export file names, labels). */
export function isoDay(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
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
