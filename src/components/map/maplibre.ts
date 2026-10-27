"use client";

import type * as MapLibre from "maplibre-gl";
import { preconnect } from "react-dom";
import { GLOBE_DATA } from "./mapStyle";

/**
 * MapLibre 6 is loaded at runtime from public/maplibre/<version>/ (ADR-017), not from
 * the bundle: the main module and the worker then share one `maplibre-gl-shared.mjs`
 * (the browser downloads it once). In the bundle the shared code would be there twice
 * (~150 kB gzip extra on every page with the globe).
 *
 * The version comes from next.config `env`, inlined at build time as a string
 * (importing maplibre-gl/package.json would bundle the whole file).
 */
const BASE = `/maplibre/${process.env.MAPLIBRE_VERSION}`;

let loading: Promise<typeof MapLibre> | null = null;

/**
 * MapLibre's stylesheet (controls, attribution, canvas), from the same folder.
 * Added only when a map starts: as an import it was a render-blocking ~80 kB
 * stylesheet on every map page, long before the globe (which waits for the
 * page's `load`). The map is created once it has applied, so no control
 * flashes unstyled; a failed stylesheet doesn't keep the map away.
 */
function loadStylesheet(): Promise<void> {
  return new Promise((resolve) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `${BASE}/maplibre-gl.css`;
    link.onload = () => resolve();
    link.onerror = () => resolve();
    document.head.append(link);
  });
}

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
  // eslint-disable-next-line no-restricted-globals -- a cache warm-up of static map data, not an API call
  void fetch(GLOBE_DATA.countries).catch(() => {});
}

export function loadMapLibre(): Promise<typeof MapLibre> {
  if (!loading) warmUp();
  loading ??= Promise.all([
    import(/* webpackIgnore: true */ /* turbopackIgnore: true */ `${BASE}/maplibre-gl.mjs`),
    loadStylesheet(),
  ]).then(([module]: [typeof MapLibre, void]) => {
    module.setWorkerUrl(`${BASE}/maplibre-gl-worker.mjs`);
    return module;
  });
  return loading;
}
