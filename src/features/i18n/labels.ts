// Konstanty pro administraci překladů bez Zodu (importují je i klientské komponenty).
import { LOCALES, type Locale } from "./config";

/** Jazyky, do kterých se překládá (angličtina je originál). */
// Aspoň jeden cílový jazyk existuje vždy (LOCALES má víc než angličtinu).
export const TARGET_LOCALES = LOCALES.filter((locale) => locale !== "en") as [Locale, ...Locale[]];

/** Popisky polí v administraci. */
export const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  name_formal: "Official name",
  tagline: "Subtitle",
  subtitle: "Subtitle",
  summary: "Summary",
  blurb: "Short description",
  profile_html: "Profile (HTML)",
  label: "Indicator name",
  short_label: "Short name",
  description: "Description",
};

export const ENTITY_LABELS = {
  region: "Regions",
  country: "Countries",
  issue: "Country groups",
  indicator: "Indicators",
} as const;
