"use client";

import type * as MapLibre from "maplibre-gl";
import { version } from "maplibre-gl/package.json";
import { preconnect } from "react-dom";
import { GLOBE_DATA } from "./mapStyle";

/**
 * MapLibre 6 is loaded at runtime from public/maplibre/<version>/ (ADR-017), not from
 * the bundle: the main module and the worker then share one `maplibre-gl-shared.mjs`
 * (the browser downloads it once). In the bundle the shared code would be there twice
 * (~150 kB gzip extra on every page with the globe).
 */
const BASE = `/maplibre/${version}`;

let loading: Promise<typeof MapLibre> | null = null;

/**
 * Everything the first globe frame needs, requested at once instead of one after
 * another: the main module only reveals its static import of the shared module
 * once it has arrived, and tiles, glyphs and borders start only after the map
 * exists. Best effort — failures here only lose the head start.
 */
function warmUp() {
  for (const origin of GLOBE_DATA.origins) preconnect(origin, { crossOrigin: "anonymous" });
  void import(
    /* webpackIgnore: true */ /* turbopackIgnore: true */ `${BASE}/maplibre-gl-shared.mjs`
  ).catch(() => {});
  // Same URL as the map's source: the worker then reads it from the HTTP cache.
  void fetch(GLOBE_DATA.countries).catch(() => {});
}

export function loadMapLibre(): Promise<typeof MapLibre> {
  if (!loading) warmUp();
  loading ??= import(
    /* webpackIgnore: true */ /* turbopackIgnore: true */ `${BASE}/maplibre-gl.mjs`
  ).then((module: typeof MapLibre) => {
    module.setWorkerUrl(`${BASE}/maplibre-gl-worker.mjs`);
    return module;
  });
  return loading;
}
