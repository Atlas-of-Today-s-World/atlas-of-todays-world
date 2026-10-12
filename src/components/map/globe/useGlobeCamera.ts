"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { globeFillZoom, miniGlobeZoom } from "@/lib/home-location";
import { DESKTOP_MIN_PX, GLOBE, MOBILE_SHEET, railKind, railWidthPx } from "@/config/layout";
import type { MapFocusState } from "../MapContext";

/**
 * Viewport padding so the content panel doesn't cover the country — on desktop
 * the right column, wide or narrow depending on the path being navigated to; on
 * phones the bottom sheet, with the place on the strip of globe above it (the map
 * controls step aside there while a panel is open). Tokens from config/layout.ts.
 */
function railPadding() {
  const { server, desktop, mobile } = GLOBE.padding;
  if (typeof window === "undefined") return server;
  if (window.innerWidth < DESKTOP_MIN_PX) {
    return {
      top: mobile.top,
      bottom: Math.round(window.innerHeight * MOBILE_SHEET.ratio) + mobile.sheetGap,
      left: mobile.side,
      right: mobile.side,
    };
  }
  const rail = railWidthPx(railKind(window.location.pathname), window.innerWidth);
  return {
    top: desktop.top,
    bottom: desktop.bottom,
    left: desktop.left,
    right: rail + desktop.railGap,
  };
}

/**
 * Camera flight to what the page focuses on: a country's bounds, a centre and
 * zoom, or (closing a panel) a zoom out over the last place. In the corner
 * window (`mini`) the whole globe, turned to the page's place.
 */
export function useGlobeCamera(
  mapRef: RefObject<MapLibreMap | null>,
  ready: boolean,
  focus: MapFocusState,
  mini: boolean,
) {
  /** The last place a page focused on (country label, region centre) – where closing a panel zooms out. */
  const lastPlaceRef = useRef<[number, number] | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (focus.center) lastPlaceRef.current = focus.center;

    // Corner window: the whole globe, turned to the page's place (if it has one).
    if (mini) {
      const zoom = miniGlobeZoom(window.innerWidth);
      map.setMinZoom(Math.min(GLOBE.minZoom, zoom));
      map.easeTo({
        center: focus.center ?? map.getCenter(),
        zoom,
        duration: GLOBE.windowMs,
      });
      return;
    }
    // Back to the full map: grow the globe with the window, then restore the usual minimum.
    if (map.getMinZoom() < GLOBE.minZoom) {
      map.once("moveend", () => map.setMinZoom(GLOBE.minZoom));
      if (!focus.bbox && !focus.center) {
        map.easeTo({ zoom: globeFillZoom(), duration: GLOBE.windowMs });
        return;
      }
    }

    // The viewport can zoom "by country size": Luxembourg up close, Russia from afar.
    if (focus.bbox) {
      const [minLon, minLat, maxLon, maxLat] = focus.bbox;
      map.fitBounds(
        [
          [minLon, minLat],
          [maxLon, maxLat],
        ],
        {
          // The content panel is on the right, so we shift the country to the left part of the map.
          padding: railPadding(),
          maxZoom: GLOBE.fitMaxZoom,
          duration: GLOBE.flightMs,
        },
      );
      return;
    }

    // Zoom only (closing a panel): zoom out over the last place instead of turning the globe away.
    if (!focus.center && focus.zoom === null) return;
    map.flyTo({
      center: focus.center ?? lastPlaceRef.current ?? map.getCenter(),
      zoom: focus.zoom ?? GLOBE.fallbackZoom,
      duration: GLOBE.flightMs,
    });
  }, [mapRef, focus.bbox, focus.center, focus.zoom, mini, ready]);
}
