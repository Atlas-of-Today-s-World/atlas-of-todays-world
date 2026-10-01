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
    type: z.enum(["sequential", "categorical"]),
    scale: z.enum(["linear", "log"]),
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

/** Manually entered value — the DB rejects it without a source (every number has an origin). */
export const ValueInput = z.object({
  indicator_id: slug(60),
  country_iso3: iso3,
  value: z.coerce.number({ message: "Enter a number." }).finite(),
  year: optionalNumber(z.number().int().min(1800).max(2100)),
  note: z.preprocess(blankToUndefined, text(120).optional()),
  source_note: requiredText(300),
});

export const CategoryInput = z.object({
  value: z.coerce.number().int(),
  label: requiredText(80),
  color: hexColor,
});
