"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";

/** Idle rotation speed: one turn in six minutes. */
export const SPIN_DEG_PER_SEC = 1;
/** Pause after the globe is ready (and after the home flight) before it starts turning. */
const START_DELAY_MS = 2500;
/** ~30 fps is smooth at this speed and halves the GPU work of a 60 fps loop. */
const FRAME_MS = 33;

/** Event data of the spin's own camera moves, so hover handling can ignore them. */
export const SPIN_EVENT = { idleSpin: true } as const;
export const isSpinEvent = (event: object) => "idleSpin" in event;

/**
 * Longitude after `elapsedMs` of spinning. The camera moves west, so the
 * surface turns eastward like the real Earth. Kept within [-180, 180).
 */
export function spinLongitude(lng: number, elapsedMs: number): number {
  const next = lng - (SPIN_DEG_PER_SEC * elapsedMs) / 1000;
  return ((((next + 180) % 360) + 360) % 360) - 180;
}

/**
 * Turns the globe very slowly while `enabled` (the home map), until the user
 * takes over: the first press, wheel or key inside `surfaceRef` stops it for
 * the rest of the visit. It waits while another camera move runs (the home
 * flight over the visitor's country) and never runs with reduced motion.
 */
export function useIdleSpin(
  mapRef: RefObject<MapLibreMap | null>,
  surfaceRef: RefObject<HTMLElement | null>,
  ready: boolean,
  enabled: boolean,
) {
  const stoppedRef = useRef(false);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const stop = () => {
      stoppedRef.current = true;
    };
    const events = ["pointerdown", "wheel", "keydown"] as const;
    for (const name of events) surface.addEventListener(name, stop, { capture: true });
    return () => {
      for (const name of events) surface.removeEventListener(name, stop, { capture: true });
    };
  }, [surfaceRef]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !enabled || stoppedRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let last = 0;
    let startAt = performance.now() + START_DELAY_MS;

    const tick = (now: number) => {
      if (stoppedRef.current) return;
      frame = requestAnimationFrame(tick);
      // Someone else moves the camera (a flight, the user): wait, then pause before resuming.
      if (map.isMoving()) {
        startAt = now + START_DELAY_MS;
        last = 0;
        return;
      }
      if (now < startAt || now - last < FRAME_MS) return;
      const elapsed = last ? now - last : FRAME_MS;
      last = now;
      const center = map.getCenter();
      map.jumpTo({ center: [spinLongitude(center.lng, elapsed), center.lat] }, SPIN_EVENT);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [mapRef, ready, enabled]);
}
