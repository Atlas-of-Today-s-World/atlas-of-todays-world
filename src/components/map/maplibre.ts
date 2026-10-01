"use client";

import type * as MapLibre from "maplibre-gl";
import { version } from "maplibre-gl/package.json";

/**
 * MapLibre 6 is loaded at runtime from public/maplibre/<version>/ (ADR-017), not from
 * the bundle: the main module and the worker then share one `maplibre-gl-shared.mjs`
 * (the browser downloads it once). In the bundle the shared code would be there twice
 * (~150 kB gzip extra on every page with the globe).
 */
const BASE = `/maplibre/${version}`;

let loading: Promise<typeof MapLibre> | null = null;

export function loadMapLibre(): Promise<typeof MapLibre> {
  loading ??= import(
    /* webpackIgnore: true */ /* turbopackIgnore: true */ `${BASE}/maplibre-gl.mjs`
  ).then((module: typeof MapLibre) => {
    module.setWorkerUrl(`${BASE}/maplibre-gl-worker.mjs`);
    return module;
  });
  return loading;
}
