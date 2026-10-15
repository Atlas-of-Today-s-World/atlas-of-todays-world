import { z } from "zod";
import { sanitizePopupHtml } from "@/lib/security/sanitize";
import { hexColor, iso3 } from "@/lib/validation/common";
import { MAP_ICON_NAMES, type MapIconName } from "./icon-names";
import { storedBytes } from "./size";
import {
  MAP_BASEMAPS,
  MAP_CORNERS,
  MAP_LIMITS,
  MAP_PROJECTIONS,
  MAP_VIEW_MODES,
  POPUP_FONTS,
  POPUP_SIZES,
  type MapSpec,
} from "./types";

/**
 * The map visual's spec at the server boundary (ARCHITEKTURA 4: Zod on every
 * boundary). Strict objects — an unknown key is an error, not silently kept —
 * with the limits of MAP_LIMITS, and popup HTML sanitized on the way in. The
 * renderer gets only what passed here.
 */

const latitude = z.number().finite().min(-MAP_LIMITS.maxLatitude).max(MAP_LIMITS.maxLatitude);
const longitude = z.number().finite().min(-180).max(180);
const text = (max: number) => z.string().trim().max(max, `At most ${max} characters.`);
const label = (max: number) => text(max).min(1, "Please fill this in.");
const icon = z.enum(MAP_ICON_NAMES as [MapIconName, ...MapIconName[]]).nullable();

const bounds = z
  .tuple([
    longitude,
    latitude,
    // East of the antimeridian is written past 180 (see MapBounds).
    z.number().finite().min(-180).max(540),
    latitude,
  ])
  .refine(([west, south, east, north]) => west < east && east - west <= 360 && south < north, {
    message: "The view must have its west edge before its east edge and south before north.",
  });

const View = z.strictObject({
  mode: z.enum(MAP_VIEW_MODES),
  countries: z.array(iso3).max(300),
  region: z
    .strictObject({ slug: z.string().regex(/^[a-z0-9-]{1,120}$/), name: label(160) })
    .nullable(),
  bounds,
  projection: z.enum(MAP_PROJECTIONS),
  basemap: z.enum(MAP_BASEMAPS),
  labels: z.boolean(),
});

const Highlight = z.strictObject({
  iso3,
  fill: hexColor,
  opacity: z.number().min(0).max(1),
  outline: hexColor.nullable(),
});

const Popup = z.strictObject({
  html: z
    .string()
    .max(MAP_LIMITS.popupHtml, `At most ${MAP_LIMITS.popupHtml} characters.`)
    .transform(sanitizePopupHtml),
  font: z.enum(POPUP_FONTS),
  size: z.enum(POPUP_SIZES),
  color: hexColor,
  background: hexColor,
  maxWidth: z.number().int().min(MAP_LIMITS.popupWidth.min).max(MAP_LIMITS.popupWidth.max),
});

const Point = z.strictObject({
  id: z.string().regex(/^[a-z0-9]{1,16}$/),
  lat: latitude,
  lon: longitude,
  label: label(MAP_LIMITS.label),
  showLabel: z.boolean(),
  color: hexColor,
  size: z.number().int().min(MAP_LIMITS.pointSize.min).max(MAP_LIMITS.pointSize.max),
  icon,
  pulse: z.boolean(),
  popup: Popup.nullable(),
});

const LegendItem = z
  .strictObject({ label: label(MAP_LIMITS.legendLabel), color: hexColor.nullable(), icon })
  .refine((item) => item.color !== null || item.icon !== null, {
    message: "A legend item needs a colour, an icon or both.",
  });

const Legend = z.strictObject({
  visible: z.boolean(),
  title: text(MAP_LIMITS.legendTitle),
  position: z.enum(MAP_CORNERS),
  items: z
    .array(LegendItem)
    .max(MAP_LIMITS.legendItems, `At most ${MAP_LIMITS.legendItems} legend items.`),
});

const duplicates = (values: string[]) => values.filter((value, i) => values.indexOf(value) !== i);

const Spec = z
  .strictObject({
    version: z.literal(1),
    view: View,
    countries: z
      .array(Highlight)
      .max(MAP_LIMITS.countries, `At most ${MAP_LIMITS.countries} highlighted countries.`),
    points: z.array(Point).max(MAP_LIMITS.points, `At most ${MAP_LIMITS.points} points.`),
    legend: Legend,
  })
  .superRefine((spec, ctx) => {
    for (const id of new Set(duplicates(spec.points.map((point) => point.id)))) {
      ctx.addIssue({ code: "custom", path: ["points"], message: `Two points share the id ${id}.` });
    }
    for (const code of new Set(duplicates(spec.countries.map((country) => country.iso3)))) {
      ctx.addIssue({
        code: "custom",
        path: ["countries"],
        message: `${code} is highlighted twice.`,
      });
    }
  });

const tooLarge = (bytes: number) => ({
  ok: false as const,
  error: `The map is too large (${Math.ceil(bytes / 1000)} kB, at most ${MAP_LIMITS.bytes / 1000} kB).`,
});

type ParseMapSpecResult = { ok: true; spec: MapSpec } | { ok: false; error: string };

/**
 * Validates a map spec (from the builder, or `visuals.map_spec` as read back)
 * and returns it with popup HTML sanitized — call it when saving and before
 * handing a stored spec to `MapVisual`. The error names the first problem
 * (`points.3.lat: …`).
 */
export function parseMapSpec(json: unknown): ParseMapSpecResult {
  const bytes = storedBytes(json);
  if (bytes === null) return { ok: false, error: "The map isn't valid JSON." };
  if (bytes > MAP_LIMITS.bytes) return tooLarge(bytes);
  const result = Spec.safeParse(json);
  if (result.success) {
    // Sanitizing adds `rel` and `target` to links: the stored spec is measured again.
    const stored = storedBytes(result.data) ?? 0;
    return stored > MAP_LIMITS.bytes ? tooLarge(stored) : { ok: true, spec: result.data };
  }
  const issue = result.error.issues[0];
  const where = issue?.path.length ? `${issue.path.join(".")}: ` : "";
  return { ok: false, error: `${where}${issue?.message ?? "Invalid map."}` };
}
