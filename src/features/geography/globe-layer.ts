import type { Locale } from "@/features/i18n/config";
import { saturateMap } from "@/lib/color";
import { colorMapFor, formatValue } from "@/lib/indicators";
import type { Indicator } from "./types";

/**
 * One data layer of the globe (a metric): each country's colour and its value
 * as the hover label shows it. Loaded by the globe only when the layer is
 * switched on (/api/globe-layer/[id]) — sending every layer with every map page
 * made up most of its HTML.
 */
export interface GlobeLayer {
  /** ISO3 → fill colour (already saturated like the rest of the map). */
  colors: Record<string, string>;
  /** Short name for the hover label ("GDP per capita"). */
  label: string;
  /** ISO3 → [formatted value, year]. */
  values: Record<string, [value: string, year: number]>;
}

export function globeLayer(indicator: Indicator, saturation: number, locale: Locale): GlobeLayer {
  return {
    colors: saturateMap(colorMapFor(indicator), saturation),
    label: indicator.shortLabel || indicator.label,
    values: Object.fromEntries(
      Object.entries(indicator.values).map(([iso3, { value, year }]) => [
        iso3,
        [formatValue(indicator, value, locale), year],
      ]),
    ),
  };
}
