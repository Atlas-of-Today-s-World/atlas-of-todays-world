import { z } from "zod";
import {
  blankToUndefined,
  hexColor,
  iso3,
  requiredText,
  slug,
  text,
} from "@/lib/validation/common";

/** Vzhled mapy (site_theme) — rozsahy shodné s CHECK v DB. */
export const ThemeInput = z.object({
  saturation: z.coerce.number().min(0.2).max(2),
  border: z.coerce.number().min(0.4).max(2.2),
});

const point = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);

/**
 * GeoJSON Polygon s jedním uzavřeným prstencem — stejná pravidla jako DB
 * funkce `is_polygon` (4–2000 bodů, první = poslední, souřadnice v rozsahu).
 */
const Polygon = z
  .object({
    type: z.literal("Polygon"),
    coordinates: z.array(z.array(point).min(4).max(2000)).length(1, "Jen jeden prstenec."),
  })
  .refine(
    (value) => {
      const ring = value.coordinates[0] ?? [];
      const [a, b] = [ring[0], ring.at(-1)];
      return Boolean(a && b && a[0] === b[0] && a[1] === b[1]);
    },
    { message: "Obrazec musí končit v bodě, kde začíná." },
  );

export const AreaInput = z.object({
  original_slug: z.preprocess(blankToUndefined, slug(120).optional()),
  slug: slug(120),
  name: requiredText(120),
  label: text(60),
  note: text(1000),
  fill: hexColor,
  stroke: hexColor,
  country_iso3: z.preprocess(blankToUndefined, iso3.optional()),
  geometry: z
    .string()
    .max(200_000, "Obrazec je příliš podrobný.")
    .transform((value, ctx) => {
      try {
        const parsed = JSON.parse(value);
        // Přijmout i celý Feature nebo FeatureCollection s jedním prvkem.
        return parsed?.type === "Feature"
          ? parsed.geometry
          : parsed?.type === "FeatureCollection"
            ? parsed.features?.[0]?.geometry
            : parsed;
      } catch {
        ctx.addIssue({ code: "custom", message: "Není to platný JSON." });
        return z.NEVER;
      }
    })
    .pipe(Polygon),
});
