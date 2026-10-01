// Konstanty pro administraci překladů bez Zodu (importují je i klientské komponenty).
import { LOCALES, type Locale } from "./config";

/** Jazyky, do kterých se překládá (angličtina je originál). */
// Aspoň jeden cílový jazyk existuje vždy (LOCALES má víc než angličtinu).
export const TARGET_LOCALES = LOCALES.filter((locale) => locale !== "en") as [Locale, ...Locale[]];

/** Popisky polí v administraci. */
export const FIELD_LABELS: Record<string, string> = {
  name: "Název",
  name_formal: "Úřední název",
  tagline: "Podtitul",
  subtitle: "Podtitul",
  summary: "Shrnutí",
  blurb: "Krátký popis",
  profile_html: "Profil (HTML)",
  label: "Název ukazatele",
  short_label: "Krátký název",
  description: "Popis",
};

export const ENTITY_LABELS = {
  region: "Regiony",
  country: "Země",
  issue: "Global Issues",
  indicator: "Ukazatele",
} as const;
