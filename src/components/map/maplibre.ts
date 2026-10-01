"use client";

import type * as MapLibre from "maplibre-gl";
import { version } from "maplibre-gl/package.json";

/**
 * MapLibre 6 se načítá za běhu z public/maplibre/<verze>/ (ADR-017), ne z
 * bundlu: hlavní modul i worker pak sdílejí jeden `maplibre-gl-shared.mjs`
 * (prohlížeč ho stáhne jednou). V bundlu by sdílený kód byl dvakrát
 * (~150 kB gzip navíc na každé stránce s glóbem).
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
