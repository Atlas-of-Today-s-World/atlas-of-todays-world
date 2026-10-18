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

/** A finger, the one pointer without hover (mouse and pen hover first). */
export const isTouchPointer = (pointerType: string | null): boolean => pointerType === "touch";

/**
 * Whether MapLibre's double-click zoom stays on for the pointer in use. A
 * finger's tap opens a place and the globe flies to it, so a double tap zooming
 * too would throw it off the place being opened; a mouse or pen double-click
 * still zooms. Pinch zoom and the + / − buttons are other handlers.
 */
export const doubleClickZooms = (pointerType: string | null): boolean =>
  !isTouchPointer(pointerType);
