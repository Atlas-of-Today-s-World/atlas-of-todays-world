import { z } from "zod";
import {
  blankToUndefined,
  checkbox,
  hexColor,
  iso3,
  optionalHttpsUrl,
  optionalNumber,
  requiredText,
  slug,
  text,
} from "@/lib/validation/common";
import { IMPORT_LIMITS, INDICATOR_SCALES, INDICATOR_TYPES, INT4 } from "./constants";

/** Indicator description and scale — limits per the `indicators` table. */
export const IndicatorInput = z
  .object({
    id: slug(60),
    is_new: checkbox,
    label: requiredText(120),
    short_label: text(60),
    description: text(1000),
    unit: text(20),
    decimals: z.coerce.number().int().min(0).max(4),
    source: text(200),
    source_url: optionalHttpsUrl,
    type: z.enum(INDICATOR_TYPES),
    scale: z.enum(INDICATOR_SCALES),
    domain_min: optionalNumber(z.number()),
    domain_max: optionalNumber(z.number()),
    ramp: z.array(hexColor).max(9),
    higher_is_better: checkbox,
  })
  .superRefine((value, ctx) => {
    if (value.type !== "sequential") return;
    if (value.domain_min === undefined || value.domain_max === undefined) {
      ctx.addIssue({ code: "custom", path: ["domain_min"], message: "The scale needs a range." });
    } else if (value.domain_min === value.domain_max) {
      ctx.addIssue({
        code: "custom",
        path: ["domain_max"],
        message: "The end must differ from the start.",
      });
    }
    if (value.scale === "log" && (value.domain_min ?? 0) <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["domain_min"],
        message: "A logarithmic scale must start above zero.",
      });
    }
    if (value.ramp.length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["ramp"],
        message: "The palette needs at least two colors.",
      });
    }
  });

/** A data year — the range of the `indicator_values` CHECK. */
const year = z.number().int().min(IMPORT_LIMITS.yearMin).max(IMPORT_LIMITS.yearMax);

/** Manually entered value — the DB rejects it without a source (every number has an origin). */
export const ValueInput = z.object({
  indicator_id: slug(60),
  country_iso3: iso3,
  value: z.coerce.number({ message: "Enter a number." }).finite(),
  year: optionalNumber(year),
  note: z.preprocess(blankToUndefined, text(IMPORT_LIMITS.note).optional()),
  source_note: requiredText(IMPORT_LIMITS.source),
});

/**
 * A CSV import (import_indicator_values): one row per country, at most
 * IMPORT_LIMITS.rows, with the limits of a value entered by hand. The browser
 * matched the countries and read the numbers; the server checks them again.
 */
export const ImportInput = z.object({
  indicator_id: slug(60),
  replace: z.boolean(),
  source_note: requiredText(IMPORT_LIMITS.source),
  rows: z
    .array(
      z.object({
        country_iso3: iso3,
        value: z.number().finite(),
        year: year.nullable(),
        note: text(IMPORT_LIMITS.note)
          .nullable()
          .transform((note) => note || null),
      }),
    )
    .min(1, "The file has no values to import.")
    .max(IMPORT_LIMITS.rows, `At most ${IMPORT_LIMITS.rows} countries in one import.`)
    .refine((rows) => new Set(rows.map((row) => row.country_iso3)).size === rows.length, {
      message: "Each country may appear only once.",
    }),
});

export const CategoryInput = z.object({
  // The column is a Postgres integer: a larger number would only fail in the DB.
  value: z.coerce.number().int().min(INT4.min).max(INT4.max),
  label: requiredText(80),
  color: hexColor,
});
