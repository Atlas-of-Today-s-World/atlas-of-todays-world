// Constants for translation admin without Zod (client components import them too).
import { LOCALES, type Locale } from "./config";

/** Languages translated into (English is the original). */
// At least one target language always exists (LOCALES has more than English).
export const TARGET_LOCALES = LOCALES.filter((locale) => locale !== "en") as [Locale, ...Locale[]];

/** Field labels in the admin. */
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
