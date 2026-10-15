"use client";

import { useEffect, type RefObject } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { ZERO_GLOW_LAYERS } from "../mapStyle";

/** One pulse of the red glow under the 0 pills: quick, so the empty places catch the eye. */
const PULSE_MS = 1100;
/** ~20 updates a second are enough for a soft glow and keep the GPU work small. */
const FRAME_MS = 50;

/** Radius and opacity of the glow at phase `t` (0 → 1 within one pulse): it grows and fades. */
export function glowAt(t: number): { radius: number; opacity: number } {
  const phase = Math.min(1, Math.max(0, t));
  return { radius: 7 + 11 * phase, opacity: 0.7 * (1 - phase) };
}

/**
 * Makes the red glow under every 0 pill pulse (countries and regions): two
 * plain paint values per frame, no layout work, paused while the tab is
 * hidden. With reduced motion the glow stays still and faint.
 */
export function useZeroPulse(mapRef: RefObject<MapLibreMap | null>, active: boolean) {
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !active) return;
    const layers = Object.values(ZERO_GLOW_LAYERS).filter((id) => map.getLayer(id));
    const paint = ({ radius, opacity }: { radius: number; opacity: number }) => {
      for (const id of layers) {
        map.setPaintProperty(id, "circle-radius", radius);
        map.setPaintProperty(id, "circle-opacity", opacity);
      }
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      paint({ radius: 10, opacity: 0.35 });
      return;
    }

    let frame = 0;
    let last = 0;
    const start = performance.now();
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (document.hidden || now - last < FRAME_MS) return;
      last = now;
      paint(glowAt(((now - start) % PULSE_MS) / PULSE_MS));
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [mapRef, active]);
}
