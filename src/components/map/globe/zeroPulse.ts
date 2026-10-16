"use client";

import { useEffect, type RefObject } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { ZERO_GLOW_LAYERS } from "../mapStyle";
import { TOUCH_FIRST_START_MS } from "../useIdleSpin";
import { isTouchScreen } from "./touch";

/** One pulse of the red glow under the 0 pills: quick, so the empty places catch the eye. */
const PULSE_MS = 1100;
/** ~20 updates a second are enough for a soft glow and keep the GPU work small. */
const FRAME_MS = 50;
/**
 * The glow pulses in short bursts with a still pause between them: every frame
 * of a pulse redraws the whole globe, which a phone's main thread pays for —
 * a glow pulsing for ever kept it busy (and the battery draining) the whole visit.
 */
const PULSES_PER_BURST = 3;
const REST_MS = 9000;
/** After the globe is ready, before the first burst: the page settles first. */
const FIRST_BURST_MS = 3000;
/** Between bursts and with reduced motion: still and faint (as the style draws it). */
const STILL_GLOW = { radius: 10, opacity: 0.35 } as const;
/** Inputs that count as the visitor's first on a touch screen (as for the idle spin). */
const FIRST_INPUTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

/** Radius and opacity of the glow at phase `t` (0 → 1 within one pulse): it grows and fades. */
export function glowAt(t: number): { radius: number; opacity: number } {
  const phase = Math.min(1, Math.max(0, t));
  return { radius: 7 + 11 * phase, opacity: 0.7 * (1 - phase) };
}

/**
 * Makes the red glow under every 0 pill pulse (countries and regions) in short
 * bursts: two plain paint values per frame, no layout work, skipped while the
 * tab is hidden. On touch screens the first burst waits, like the idle spin,
 * for the visitor's first input (or TOUCH_FIRST_START_MS). With reduced motion
 * the glow stays still and faint.
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
      paint(STILL_GLOW);
      return;
    }

    let frame = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const burst = () => {
      if (document.hidden) {
        timer = setTimeout(burst, REST_MS);
        return;
      }
      const start = performance.now();
      let last = 0;
      const tick = (now: number) => {
        const elapsed = now - start;
        if (elapsed >= PULSE_MS * PULSES_PER_BURST) {
          paint(STILL_GLOW);
          timer = setTimeout(burst, REST_MS);
          return;
        }
        frame = requestAnimationFrame(tick);
        if (now - last < FRAME_MS) return;
        last = now;
        paint(glowAt((elapsed % PULSE_MS) / PULSE_MS));
      };
      frame = requestAnimationFrame(tick);
    };

    const touch = isTouchScreen();
    const options = { capture: true, passive: true };
    const firstInput = () => {
      for (const name of FIRST_INPUTS) window.removeEventListener(name, firstInput, options);
      clearTimeout(timer);
      timer = setTimeout(burst, FIRST_BURST_MS);
    };
    if (touch) for (const name of FIRST_INPUTS) window.addEventListener(name, firstInput, options);
    timer = setTimeout(burst, touch ? TOUCH_FIRST_START_MS : FIRST_BURST_MS);

    return () => {
      for (const name of FIRST_INPUTS) window.removeEventListener(name, firstInput, options);
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [mapRef, active]);
}
