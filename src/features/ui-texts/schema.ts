import { z } from "zod";
import { editableText, MAX_TEXT_LENGTH, normalizeText, overrideProblem } from "./model";

/**
 * Admin form of a UI text (Admin → UI texts). The rules are `overrideProblem`
 * (model.ts) — the same check the public read applies — and match the CHECKs
 * in 20261013000280_ui_text_overrides.sql (length, not blank, no "<").
 */

/** The key of an editable text (a dot path in en.json). */
export const UiTextKey = z
  .string()
  .max(200)
  .refine((key) => editableText(key) !== undefined, "Unknown text.");

export const UiTextInput = z
  .object({
    key: z.string().max(200),
    // Line ends as the browser posts them (\r\n) count once, like in the DB.
    value: z
      .string()
      .max(MAX_TEXT_LENGTH * 2, `At most ${MAX_TEXT_LENGTH} characters.`)
      .transform(normalizeText),
  })
  .superRefine(({ key, value }, ctx) => {
    const problem = overrideProblem(key, value);
    if (problem) ctx.addIssue({ code: "custom", path: [problem.field], message: problem.message });
  });

/** Most texts one form saves at once (a page's texts in Admin → Site pages). */
const MAX_TEXTS = 400;

/**
 * Several UI texts saved together (posted as `key → text`), each checked like
 * `UiTextInput`; an error sits under its key.
 */
export const UiTextsInput = z
  .record(
    z.string().max(200),
    z
      .string()
      .max(MAX_TEXT_LENGTH * 2, `At most ${MAX_TEXT_LENGTH} characters.`)
      .transform(normalizeText),
  )
  .refine((texts) => Object.keys(texts).length <= MAX_TEXTS, "Too many texts at once.")
  .superRefine((texts, ctx) => {
    for (const [key, value] of Object.entries(texts)) {
      const problem = overrideProblem(key, value);
      if (problem) ctx.addIssue({ code: "custom", path: [key], message: problem.message });
    }
  });
