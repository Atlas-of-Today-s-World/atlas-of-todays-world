/**
 * Indicator code lists without Zod — the schema, the types and the admin form's
 * options all read them (matching the CHECKs on `indicators.type` and `.scale`).
 */

/** How values are coloured: along a scale, or one colour per category. */
export const INDICATOR_TYPES = ["sequential", "categorical"] as const;
export type IndicatorType = (typeof INDICATOR_TYPES)[number];

export const INDICATOR_TYPE_LABEL: Record<IndicatorType, string> = {
  sequential: "Continuous scale",
  categorical: "Categories",
};

/** How a continuous scale maps values onto the palette. */
export const INDICATOR_SCALES = ["linear", "log"] as const;
export type IndicatorScale = (typeof INDICATOR_SCALES)[number];

export const INDICATOR_SCALE_LABEL: Record<IndicatorScale, string> = {
  linear: "Linear",
  log: "Logarithmic",
};

/** Bounds of a Postgres `integer` (`indicator_categories.value`). */
export const INT4 = { min: -2_147_483_648, max: 2_147_483_647 } as const;

/**
 * Limits of the CSV import. `rows` (one per country) and the value limits are
 * the ones import_indicator_values() and the `indicator_values` CHECKs hold;
 * `bytes` and `records` only keep the browser from reading a huge file (a
 * long-format file with every year of every country fits easily).
 */
export const IMPORT_LIMITS = {
  bytes: 1_000_000,
  records: 20_000,
  rows: 1000,
  note: 120,
  source: 300,
  yearMin: 1800,
  yearMax: 2100,
} as const;
