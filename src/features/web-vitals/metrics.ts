/**
 * Real visitors' Core Web Vitals, counted without cookies (ADR-033) — the one
 * definition of what is measured (client, route handler and admin). The
 * database holds the same lists in record_web_vitals() and the CHECKs of
 * web_vitals_daily (migration 20261027000100_web_vitals; metrics.test.ts keeps
 * them equal).
 *
 * No imports: the browser reporter uses it as well.
 */

/** Metrics reported by `useReportWebVitals` that are kept. */
export const WEB_VITALS = ["LCP", "INP", "CLS", "FCP", "TTFB"] as const;
export type WebVital = (typeof WEB_VITALS)[number];

/** Device class: a touch screen or a window under 768 px is "mobile". No user agent. */
export const DEVICES = ["mobile", "desktop"] as const;
export type Device = (typeof DEVICES)[number];

/** Navigation types kept (web-vitals' finer ones are folded into these). */
export const NAV_TYPES = ["navigate", "reload", "back-forward", "soft"] as const;
export type NavType = (typeof NAV_TYPES)[number];

/**
 * Largest value stored: timings in whole ms up to a minute, CLS × 1000 up to
 * 10 (a layout shift score of 10 is already absurd). Larger values are not sent.
 */
export const VALUE_MAX: Record<WebVital, number> = {
  LCP: 60000,
  INP: 60000,
  CLS: 10000,
  FCP: 60000,
  TTFB: 60000,
};

/**
 * "Good" up to the first number, "poor" above the second (web.dev thresholds,
 * the same as CrUX and PageSpeed). In stored units: ms, CLS × 1000.
 */
export const THRESHOLDS: Record<WebVital, readonly [good: number, poor: number]> = {
  LCP: [2500, 4000],
  INP: [200, 500],
  CLS: [100, 250],
  FCP: [1800, 3000],
  TTFB: [800, 1800],
};

export const VITAL_LABEL: Record<WebVital, string> = {
  LCP: "Largest Contentful Paint",
  INP: "Interaction to Next Paint",
  CLS: "Cumulative Layout Shift",
  FCP: "First Contentful Paint",
  TTFB: "Time to First Byte",
};

export type Rating = "good" | "needs-improvement" | "poor";

export const RATING_LABEL: Record<Rating, string> = {
  good: "Good",
  "needs-improvement": "Needs improvement",
  poor: "Poor",
};

/** Rating of a stored value (ms, CLS × 1000), as web-vitals rates it. */
export function rating(metric: WebVital, value: number): Rating {
  const [good, poor] = THRESHOLDS[metric];
  if (value <= good) return "good";
  return value <= poor ? "needs-improvement" : "poor";
}

/** A stored value for people: "0.08" (CLS), "180 ms", "2.45 s". */
export function formatVital(metric: WebVital, value: number): string {
  if (metric === "CLS") return (value / 1000).toFixed(2);
  return value < 1000 ? `${Math.round(value)} ms` : `${(value / 1000).toFixed(2)} s`;
}
