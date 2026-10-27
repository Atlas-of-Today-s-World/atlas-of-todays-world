import { isoDay } from "@/lib/format";
import { DEVICES, WEB_VITALS, rating, type Device, type Rating, type WebVital } from "./metrics";

/** Windows of the admin overview, in days (today included). */
export const VITALS_WINDOWS = { week: 7, month: 28 } as const;

/** Days of the daily trend, and the metrics it follows on mobile. */
export const TREND_DAYS = 28;
export const TREND_METRICS = ["LCP", "INP"] as const satisfies readonly WebVital[];
export type TrendMetric = (typeof TREND_METRICS)[number];

/** A row of web_vitals_p75() (day only when read per day). */
export interface P75Row {
  day: string | null;
  metric: string;
  device: string;
  samples: number;
  p75: number;
}

/** The 75th percentile of one metric (ms, CLS × 1000) and how many page views it rests on. */
export interface VitalReading {
  p75: number;
  samples: number;
  rating: Rating;
}

export interface VitalsSummary {
  /** Every metric × device, for the last 7 and 28 days (null = no samples). */
  table: {
    metric: WebVital;
    device: Device;
    week: VitalReading | null;
    month: VitalReading | null;
  }[];
  /** Mobile LCP and INP per day, oldest first (TREND_DAYS days ending today). */
  trend: { day: string; readings: Record<TrendMetric, VitalReading | null> }[];
}

const isVital = (value: string): value is WebVital =>
  (WEB_VITALS as readonly string[]).includes(value);

function reading(row: P75Row | undefined): VitalReading | null {
  if (!row || !isVital(row.metric) || row.samples <= 0) return null;
  return { p75: row.p75, samples: row.samples, rating: rating(row.metric, row.p75) };
}

const key = (...parts: (string | null)[]) => parts.join("|");
const byKey = (rows: readonly P75Row[]) =>
  new Map(rows.map((row) => [key(row.day, row.metric, row.device), row]));

/** "YYYY-MM-DD" of `today` minus `days` (UTC, like the database's current_date). */
const daysBefore = (today: Date, days: number) =>
  isoDay(
    new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - days)),
  );

/** The three reads of web_vitals_p75() → the admin's table and mobile trend. */
export function summariseVitals(
  week: readonly P75Row[],
  month: readonly P75Row[],
  daily: readonly P75Row[],
  today: Date,
): VitalsSummary {
  const weekRows = byKey(week);
  const monthRows = byKey(month);
  const dailyRows = byKey(daily);
  return {
    table: WEB_VITALS.flatMap((metric) =>
      DEVICES.map((device) => ({
        metric,
        device,
        week: reading(weekRows.get(key(null, metric, device))),
        month: reading(monthRows.get(key(null, metric, device))),
      })),
    ),
    trend: Array.from({ length: TREND_DAYS }, (_, index) => {
      const day = daysBefore(today, TREND_DAYS - 1 - index);
      return {
        day,
        readings: {
          LCP: reading(dailyRows.get(key(day, "LCP", "mobile"))),
          INP: reading(dailyRows.get(key(day, "INP", "mobile"))),
        },
      };
    }),
  };
}
