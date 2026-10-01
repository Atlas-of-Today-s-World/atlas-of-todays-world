import { z } from "zod";
import { TARGET_LOCALES } from "./labels";
import { TRANSLATABLE_ENTITIES } from "./translatable";

/** Saving translations of one unit; empty field = delete the translation (the site shows English). */
export const TranslationInput = z.object({
  entity: z.enum(TRANSLATABLE_ENTITIES as [string, ...string[]]),
  key: z.string().trim().min(1).max(120),
  locale: z.enum(TARGET_LOCALES as [string, ...string[]]),
  fields: z.record(z.string(), z.string().max(20000, "At most 20,000 characters.")),
});
