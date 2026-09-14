import raw from "@/data/indicators.generated.json";

export interface IndicatorCategory {
  value: number;
  label: string;
  color: string;
}

export interface Indicator {
  id: string;
  label: string;
  shortLabel: string;
  owidSlug: string;
  unit: string;
  decimals: number;
  source: string;
  sourceUrl: string;
  type: "sequential" | "categorical";
  scale?: "log";
  domain?: [number, number];
  ramp?: string[];
  categories?: IndicatorCategory[];
  higherIsBetter: boolean;
  latestYear: number | null;
  countryCount: number;
  values: Record<string, { value: number; year: number }>;
}

const INDICATOR_MAP = raw as unknown as Record<string, Indicator>;

export const INDICATORS: Indicator[] = Object.values(INDICATOR_MAP);

export const INDICATOR_IDS = INDICATORS.map((indicator) => indicator.id);

export function getIndicator(id: string): Indicator | null {
  return INDICATOR_MAP[id] ?? null;
}

/**
 * Barva země pro danou vrstvu. Sekvenční škály interpolují mezi zastávkami
 * rampy, kategoriální berou barvu přímo z číselníku.
 */
export function colorForValue(indicator: Indicator, value: number): string {
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
  return mixHex(ramp[lower], ramp[upper], scaled - lower);
}

function normalise(
  value: number,
  min: number,
  max: number,
  scale?: "log",
): number {
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
  const mix = ca.map((channel, i) => Math.round(channel + (cb[i] - channel) * t));
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

/** Naformátuje hodnotu pro kartu země a legendu. */
export function formatValue(indicator: Indicator, value: number): string {
  if (indicator.type === "categorical") {
    const match = indicator.categories?.find((c) => c.value === Math.round(value));
    return match?.label ?? "—";
  }
  if (indicator.id === "gdp-per-capita") {
    return `${Math.round(value).toLocaleString("en-US")}${indicator.unit}`;
  }
  return `${value.toFixed(indicator.decimals)}${indicator.unit}`;
}

/**
 * Hodnoty pro obarvení globusu: {ISO3: "#rrggbb"}. Posílá se do klienta jako
 * jeden malý objekt místo celého datasetu.
 */
export function colorMapFor(indicatorId: string): Record<string, string> {
  const indicator = getIndicator(indicatorId);
  if (!indicator) return {};
  const out: Record<string, string> = {};
  for (const [iso3, entry] of Object.entries(indicator.values)) {
    out[iso3] = colorForValue(indicator, entry.value);
  }
  return out;
}

/** Podklad pro legendu pod globusem. */
export function legendFor(indicator: Indicator): {
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
      label: formatValue(indicator, value),
    };
  });
  return { swatches, caption };
}
