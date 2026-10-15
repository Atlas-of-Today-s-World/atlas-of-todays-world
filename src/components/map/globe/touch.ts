import type { MapOptions, StyleSpecification } from "maplibre-gl";

/**
 * Phones and tablets (a coarse primary pointer): the globe does less there, so
 * the page answers taps sooner (Total Blocking Time, Interaction to Next Paint).
 * Desktop keeps every animation.
 */
export function isTouchScreen(): boolean {
  return window.matchMedia("(pointer: coarse)").matches;
}

/**
 * Tiles kept per source on touch screens. MapLibre's default sizes the cache
 * to five zoom levels of the viewport; 64 still holds the whole globe at the
 * zoom it opens with plus a country close-up, with far less decoded imagery
 * in a phone's memory.
 */
const TOUCH_TILE_CACHE = 64;

/** MapLibre options on touch screens: no label cross-fades, a smaller tile cache. */
export const TOUCH_MAP_OPTIONS = {
  fadeDuration: 0,
  maxTileCacheSize: TOUCH_TILE_CACHE,
} satisfies Partial<MapOptions>;

/**
 * The style on touch screens: imagery tiles appear without a cross-fade (each
 * fade keeps the map redrawing every frame while tiles arrive).
 */
export function touchStyle(style: StyleSpecification): StyleSpecification {
  return {
    ...style,
    layers: style.layers.map((layer) =>
      layer.type === "raster"
        ? { ...layer, paint: { ...layer.paint, "raster-fade-duration": 0 } }
        : layer,
    ),
  };
}
