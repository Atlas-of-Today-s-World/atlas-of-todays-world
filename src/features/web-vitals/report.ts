import { isTouchScreen } from "@/components/map/globe/touch";
import { DESKTOP_MIN_PX } from "@/config/layout";
import { VALUE_MAX, WEB_VITALS, type Device, type NavType, type WebVital } from "./metrics";

/**
 * Sending Core Web Vitals from the browser (ADR-033). Each metric of a page
 * view is queued once and sent with the others in one `navigator.sendBeacon`
 * to our own /api/v (CSP connect-src 'self') when the page is hidden — the
 * moment web-vitals reports its final LCP, CLS and INP — so it never waits,
 * never blocks the main thread and survives the page unloading. No cookie,
 * no identifier: per metric only its name, the rounded value, the first path
 * segment and the navigation type; per beacon mobile or desktop.
 */

/** What `useReportWebVitals` hands over (the fields used here). */
export interface ReportedMetric {
  name: string;
  value: number;
  /** Unique per metric and page view. */
  id: string;
  navigationType?: string;
  /** The page the metric belongs to (after a soft navigation, the URL may have changed since). */
  navigationURL?: string;
}

/** One metric as the browser sends it (VitalsInput on the server). */
export interface VitalItem {
  n: WebVital;
  v: number;
  p: string;
  t: NavType;
}

/** Most metrics in one beacon (the route handler and record_web_vitals() accept no more). */
export const VITALS_PER_BEACON = 10;

const isVital = (name: string): name is WebVital =>
  (WEB_VITALS as readonly string[]).includes(name);

/** "mobile" on a touch screen or a window narrower than the desktop layout. */
export function deviceClass(): Device {
  return isTouchScreen() || window.innerWidth < DESKTOP_MIN_PX ? "mobile" : "desktop";
}

/**
 * The first path segment ("/country/china?x=1" → "/country"); anything that
 * isn't a plain lowercase word is "/other". The database maps it to the page
 * groups of the conversion counter.
 */
export function pageSegment(url: string | undefined, fallbackPath: string): string {
  let path = fallbackPath;
  if (url) {
    try {
      path = new URL(url, "https://atlas.invalid").pathname;
    } catch {
      // Keep the fallback.
    }
  }
  const segment = /^\/([^/?#]*)/.exec(path)?.[1]?.toLowerCase() ?? "";
  return /^[a-z-]{0,32}$/.test(segment) ? `/${segment}` : "/other";
}

/** web-vitals' navigation types folded into the four kept. */
export function navType(type: string | undefined): NavType {
  switch (type) {
    case "reload":
      return "reload";
    case "back-forward":
    case "back-forward-cache":
      return "back-forward";
    case "soft-navigation":
      return "soft";
    // navigate, prerender (activation-adjusted), restore (after a discard).
    default:
      return "navigate";
  }
}

/** Value as stored: whole ms, CLS × 1000; null when not a number or out of range. */
export function storedValue(metric: WebVital, value: number): number | null {
  if (!Number.isFinite(value) || value < 0) return null;
  const rounded = Math.round(metric === "CLS" ? value * 1000 : value);
  return rounded <= VALUE_MAX[metric] ? rounded : null;
}

/** The beacon item for a reported metric, or null when it isn't one we keep. */
export function vitalItem(metric: ReportedMetric, fallbackPath: string): VitalItem | null {
  if (!isVital(metric.name)) return null;
  const value = storedValue(metric.name, metric.value);
  if (value === null) return null;
  return {
    n: metric.name,
    v: value,
    p: pageSegment(metric.navigationURL, fallbackPath),
    t: navType(metric.navigationType),
  };
}

interface QueueOptions {
  send: (body: string) => void;
  device: () => Device;
  path: () => string;
  hidden: () => boolean;
}

/**
 * Pending metrics of this page, sent together by `flush()` (on hide), at most
 * VITALS_PER_BEACON per beacon. Every metric id is sent at most once; a
 * metric reported while the page is already hidden goes out right away.
 * Never throws.
 */
export function createVitalsQueue({ send, device, path, hidden }: QueueOptions) {
  const pending = new Map<string, VitalItem>();
  const sent = new Set<string>();
  let scheduled = false;

  function flush() {
    scheduled = false;
    if (pending.size === 0) return;
    try {
      const items = [...pending.values()];
      for (const id of pending.keys()) sent.add(id);
      pending.clear();
      const d = device();
      for (let at = 0; at < items.length; at += VITALS_PER_BEACON) {
        send(JSON.stringify({ d, m: items.slice(at, at + VITALS_PER_BEACON) }));
      }
    } catch {
      // Measuring must never break the page.
    }
  }

  function add(metric: ReportedMetric) {
    try {
      if (sent.has(metric.id)) return;
      const item = vitalItem(metric, path());
      if (!item) return;
      pending.set(metric.id, item);
      if (pending.size >= VITALS_PER_BEACON) flush();
      else if (hidden() && !scheduled) {
        scheduled = true;
        queueMicrotask(flush);
      }
    } catch {
      // Measuring must never break the page.
    }
  }

  return { add, flush };
}
