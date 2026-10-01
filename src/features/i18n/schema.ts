import { z } from "zod";
import { LOCALES } from "./config";
import { TRANSLATABLE_ENTITIES } from "./translatable";

/** Jazyky, do kterých se překládá (angličtina je originál). */
export const TARGET_LOCALES = LOCALES.filter((locale) => locale !== "en");

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

/** Uložení překladů jednoho celku; prázdné pole = překlad smazat (web ukáže angličtinu). */
export const TranslationInput = z.object({
  entity: z.enum(TRANSLATABLE_ENTITIES as [string, ...string[]]),
  key: z.string().trim().min(1).max(120),
  locale: z.enum(TARGET_LOCALES as [string, ...string[]]),
  fields: z.record(z.string(), z.string().max(20000, "Nejvýš 20 000 znaků.")),
});
