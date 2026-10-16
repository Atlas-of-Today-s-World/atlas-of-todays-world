import type { Locale } from "@/lib/i18n/config";
import { saturateMap } from "@/lib/color";
import { colorMapFor, formatValue } from "@/features/geography/indicators";
import type { IndicatorData } from "./types";

/**
 * One data layer of the globe (a metric): each country's colour and its
 * formatted value. Loaded by the globe only when the layer is
 * switched on (/api/globe-layer/[id]) — sending every layer with every map page
 * made up most of its HTML.
 */
export interface GlobeLayer {
  /** ISO3 → fill colour (already saturated like the rest of the map). */
  colors: Record<string, string>;
  /** Short name of the metric ("GDP per capita"). */
  label: string;
  /** ISO3 → [formatted value, year]. */
  values: Record<string, [value: string, year: number]>;
}

export function globeLayer(
  indicator: IndicatorData,
  saturation: number,
  locale: Locale,
): GlobeLayer {
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
