import type { Locale } from "@/features/i18n/config";
import { formatNumber } from "@/lib/format";
import type { Indicator } from "@/features/geography/types";

/**
 * Colors, legend and value formatting for data layers. Pure functions over
 * `Indicator` from the database (features/geography/model.ts).
 */

/**
 * Country color for the given layer. Sequential scales interpolate between
 * ramp stops; categorical ones take the color straight from the lookup table.
 */
function colorForValue(indicator: Indicator, value: number): string {
  if (indicator.type === "categorical") {
    const match = indicator.categories?.find((c) => c.value === Math.round(value));
    return match?.color ?? "#C9CED8";
  }

  const ramp = indicator.ramp ?? ["#EEF2F7", "#1D3A8A"];
  const [min, max] = indicator.domain ?? [0, 1];
  const t = normalise(value, min, max, indicator.scale);
  const scaled = t * (ramp.length - 1);
  const lower = Math.floor(scaled);
  const upper = Math.min(lower + 1, ramp.length - 1);
  return mixHex(ramp[lower] ?? "#C9CED8", ramp[upper] ?? "#C9CED8", scaled - lower);
}

function normalise(value: number, min: number, max: number, scale?: "log"): number {
  if (scale === "log") {
    const safe = Math.max(value, 1);
    const t = (Math.log(safe) - Math.log(min)) / (Math.log(max) - Math.log(min));
    return clamp01(t);
  }
  return clamp01((value - min) / (max - min));
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function mixHex(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const mix = ca.map((channel, i) => Math.round(channel + ((cb[i] ?? channel) - channel) * t));
  return `#${mix.map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

/** Formats a value for the country card and the legend. */
export function formatValue(indicator: Indicator, value: number, locale: Locale = "en"): string {
  if (indicator.type === "categorical") {
    const match = indicator.categories?.find((c) => c.value === Math.round(value));
    return match?.label ?? "—";
  }
  if (indicator.id === "gdp-per-capita") {
    return `${formatNumber(Math.round(value), 0, locale)}${indicator.unit}`;
  }
  return `${formatNumber(value, indicator.decimals, locale)}${indicator.unit}`;
}

/**
 * Values for coloring the globe: {ISO3: "#rrggbb"}. Sent to the client as
 * one small object instead of the whole dataset.
 */
export function colorMapFor(indicator: Indicator): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [iso3, item] of Object.entries(indicator.values)) {
    out[iso3] = colorForValue(indicator, item.value);
  }
  return out;
}

/** Data for the legend below the globe. */
export function legendFor(
  indicator: Indicator,
  locale: Locale = "en",
): {
  swatches: { color: string; label: string }[];
  caption: string;
} {
  const caption = `${indicator.label}${
    indicator.latestYear ? ` – ${indicator.latestYear}` : ""
  } · Source: ${indicator.source}`;

  if (indicator.type === "categorical") {
    return {
      swatches: (indicator.categories ?? []).map((category) => ({
        color: category.color,
        label: category.label,
      })),
      caption,
    };
  }

  const [min, max] = indicator.domain ?? [0, 1];
  const steps = 5;
  const swatches = Array.from({ length: steps }, (_, i) => {
    const value = min + ((max - min) * i) / (steps - 1);
    return {
      color: colorForValue(indicator, value),
      label: formatValue(indicator, value, locale),
    };
  });
  return { swatches, caption };
}
