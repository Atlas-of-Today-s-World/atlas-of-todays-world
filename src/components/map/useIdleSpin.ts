"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";

/** Idle rotation speed: one turn in six minutes. */
export const SPIN_DEG_PER_SEC = 1;
/** Pause after the globe is ready (and after the home flight) before it starts turning. */
const START_DELAY_MS = 2500;
/** After the visitor's last touch of the globe, it starts turning again this much later. */
const RESUME_AFTER_MS = 5000;
/** While the globe turns, `onBeat` fires this often (the topic count pulse). */
const BEAT_MS = 3000;
/** ~30 fps is smooth at this speed and halves the GPU work of a 60 fps loop. */
const FRAME_MS = 33;
/**
 * On touch screens (phones, tablets) ~12 fps: at one degree a second each step
 * is still under a pixel, and a phone's CPU stays free to answer taps quickly
 * (Interaction to Next Paint).
 */
const FRAME_MS_TOUCH = 80;

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
 * Turns the globe very slowly while `enabled` (the home map) — its default
 * state:
 * - any press, drag, hover, wheel or key on the globe pauses it, and after
 *   RESUME_AFTER_MS without one it turns again (input on the map's own
 *   buttons doesn't count, so the controls can be used while it turns);
 * - it waits while another camera move runs (the home flight over the
 *   visitor's country);
 * - `toggle()` (the rotate button) starts it at once, or stops it until the
 *   visitor starts it again;
 * - never with reduced motion (`available` is then false).
 * While it turns, `onBeat` is called every few seconds (the topic count pulse).
 */
export function useIdleSpin(
  mapRef: RefObject<MapLibreMap | null>,
  surfaceRef: RefObject<HTMLElement | null>,
  ready: boolean,
  enabled: boolean,
  onBeat?: () => void,
) {
  /** performance.now() of the visitor's last input on the globe (-Infinity: none yet). */
  const lastInputRef = useRef(Number.NEGATIVE_INFINITY);
  /** Stopped with the button: no automatic restart until started again. */
  const heldRef = useRef(false);
  /** Started with the button: turn from the next frame, without the start delay. */
  const kickRef = useRef(false);
  const onBeatRef = useRef(onBeat);
  const [spinning, setSpinning] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  useEffect(() => {
    onBeatRef.current = onBeat;
  });

  // The user's motion setting exists only in the browser.
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const touched = (event: Event) => {
      if (event.target instanceof Element && event.target.closest("button, a")) return;
      lastInputRef.current = performance.now();
    };
    const events = ["pointerdown", "pointermove", "wheel", "keydown", "touchstart"] as const;
    const options = { capture: true, passive: true };
    for (const name of events) surface.addEventListener(name, touched, options);
    return () => {
      for (const name of events) surface.removeEventListener(name, touched, options);
    };
  }, [surfaceRef]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !enabled || reducedMotion) return;

    const frameMs = window.matchMedia("(pointer: coarse)").matches ? FRAME_MS_TOUCH : FRAME_MS;
    let frame = 0;
    let last = 0;
    let startAt = performance.now() + START_DELAY_MS;
    let beatAt = startAt + BEAT_MS;
    let turning = false;
    // Only transitions reach React state, not every frame.
    const report = (value: boolean) => {
      if (value === turning) return;
      turning = value;
      setSpinning(value);
    };

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (kickRef.current) {
        kickRef.current = false;
        startAt = now;
        lastInputRef.current = Number.NEGATIVE_INFINITY;
        beatAt = now + BEAT_MS / 3;
      }
      if (heldRef.current) {
        last = 0;
        report(false);
        return;
      }
      // Someone else moves the camera (a flight, the user): wait, then pause before resuming.
      if (map.isMoving()) {
        startAt = now + START_DELAY_MS;
        last = 0;
        report(false);
        return;
      }
      // Paused while the visitor uses the globe; the first pulse soon after it turns again.
      const resumeAt = Math.max(startAt, lastInputRef.current + RESUME_AFTER_MS);
      if (now < resumeAt) {
        beatAt = resumeAt + BEAT_MS / 2;
        last = 0;
        report(false);
        return;
      }
      report(true);
      if (now - last < frameMs) return;
      const elapsed = last ? now - last : frameMs;
      last = now;
      const center = map.getCenter();
      map.jumpTo({ center: [spinLongitude(center.lng, elapsed), center.lat] }, SPIN_EVENT);
      if (now >= beatAt) {
        beatAt = now + BEAT_MS;
        onBeatRef.current?.();
      }
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      setSpinning(false);
    };
  }, [mapRef, ready, enabled, reducedMotion]);

  /** The rotate button: start now, or stop until started again. */
  const toggle = useCallback(() => {
    if (spinning) {
      heldRef.current = true;
    } else {
      heldRef.current = false;
      kickRef.current = true;
    }
  }, [spinning]);

  return { spinning, available: enabled && !reducedMotion, toggle };
}
