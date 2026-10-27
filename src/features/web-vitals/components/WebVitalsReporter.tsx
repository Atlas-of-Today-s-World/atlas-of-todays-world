"use client";

import { useEffect } from "react";
import { useReportWebVitals } from "next/web-vitals";
import { apiRoutes } from "@/config/routes";
import { createVitalsQueue, deviceClass, type ReportedMetric } from "../report";

/** One queue per page load (the public layout mounts this once and keeps it). */
const queue = createVitalsQueue({
  send: (body) => {
    if (typeof navigator.sendBeacon === "function") navigator.sendBeacon(apiRoutes.vitals, body);
  },
  device: deviceClass,
  path: () => window.location.pathname,
  hidden: () => document.visibilityState === "hidden",
});

/** Stable reference: `useReportWebVitals` re-registers when the callback changes. */
const report = (metric: ReportedMetric) => queue.add(metric);

/**
 * Real visitors' Core Web Vitals (LCP, INP, CLS, FCP, TTFB) for the admin
 * overview, without cookies (features/web-vitals, ADR-033). Mounted once in
 * the public layout; renders nothing. Metrics wait in a queue and leave in one
 * beacon when the page is hidden or unloads.
 */
export function WebVitalsReporter() {
  useReportWebVitals(report);
  useEffect(() => {
    // On the document (bubble phase): web-vitals' own window capture listener
    // has reported the final values by then.
    const onVisibility = () => {
      if (document.visibilityState === "hidden") queue.flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", queue.flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", queue.flush);
    };
  }, []);
  return null;
}
