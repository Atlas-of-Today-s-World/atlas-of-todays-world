"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { isTouchScreen } from "./globe/touch";

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
/**
 * A step that took longer than this means the device can't draw the globe
 * fast enough (software WebGL, a weak phone): each frame then blocks the main
 * thread for hundreds of milliseconds and taps wait behind it.
 */
const SLOW_STEP_MS = 250;
/** This many slow steps in a row stop the spin until the visitor starts it again. */
const SLOW_STEPS_TO_STOP = 3;
/** On touch screens a scroll (the page, a list) pauses it; it turns again this much later. */
const SCROLL_SETTLE_MS = 1500;
/**
 * While the globe can't turn (waiting, paused, stopped) it checks again this
 * often on a timer instead of every animation frame: an animation frame
 * requested 60 times a second makes the browser compose the whole page each
 * time, which without a graphics chip is most of the main thread's work.
 */
const IDLE_POLL_MS = 250;

/** When the spin may turn, from the timestamps (performance.now()) it waits on. */
export interface SpinClock {
  /** After the globe is ready, after another camera move, or the rotate button. */
  startAt: number;
  /** The visitor's last input on the globe (-Infinity: none yet). */
  lastInputAt: number;
  /** Touch screens only (null on desktop). */
  touch: {
    /** Any input on the page so far (or the rotate button). */
    interacted: boolean;
    /** The last scroll anywhere on the page (-Infinity: none yet). */
    lastScrollAt: number;
  } | null;
}

/**
 * The moment the spin may turn (again). On touch screens never before the
 * visitor's first input on the page: a phone that only loads the page draws
 * nothing more once the globe is shown.
 */
export function spinResumeAt({ startAt, lastInputAt, touch }: SpinClock): number {
  const resumeAt = Math.max(startAt, lastInputAt + RESUME_AFTER_MS);
  if (!touch) return resumeAt;
  if (!touch.interacted) return Number.POSITIVE_INFINITY;
  return Math.max(resumeAt, touch.lastScrollAt + SCROLL_SETTLE_MS);
}

/**
 * Counts slow spin steps in a row; true once the spin should stop. A single
 * slow step (a tab coming back, a garbage collection) doesn't count.
 */
export function slowStepWatch() {
  let slow = 0;
  return (stepMs: number) => {
    slow = stepMs > SLOW_STEP_MS ? slow + 1 : 0;
    return slow >= SLOW_STEPS_TO_STOP;
  };
}

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
 * - never with reduced motion (`available` is then false);
 * - not while the globe is hidden (the corner window on phones);
 * - on touch screens (phones, tablets) it starts only after the visitor's first
 *   input on the page, and pauses while the page scrolls or the bottom sheet is
 *   expanded;
 * - with `auto` false (a device drawing in software, see globe/lowPower) it
 *   never starts by itself, only with the rotate button;
 * - when the device can't keep up (SLOW_STEPS_TO_STOP steps over SLOW_STEP_MS)
 *   it stops until the visitor starts it again.
 * While it turns, `onBeat` is called every few seconds (the topic count pulse).
 */
export function useIdleSpin(
  mapRef: RefObject<MapLibreMap | null>,
  surfaceRef: RefObject<HTMLElement | null>,
  ready: boolean,
  enabled: boolean,
  onBeat?: () => void,
  auto = true,
) {
  /** performance.now() of the visitor's last input on the globe (-Infinity: none yet). */
  const lastInputRef = useRef(Number.NEGATIVE_INFINITY);
  /** Stopped with the button: no automatic restart until started again. */
  const heldRef = useRef(false);
  /** Started with the button: turn from the next frame, without the start delay. */
  const kickRef = useRef(false);
  /** The globe has a size (the corner window is left out on phones). */
  const shownRef = useRef(true);
  /** Touch screens: any input on the page so far, and its last scroll. */
  const pageRef = useRef({ interacted: false, lastScrollAt: Number.NEGATIVE_INFINITY });
  /** Started with the rotate button (counts even when `auto` is off). */
  const manualRef = useRef(false);
  const autoRef = useRef(auto);
  const onBeatRef = useRef(onBeat);
  const [spinning, setSpinning] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  useEffect(() => {
    onBeatRef.current = onBeat;
    autoRef.current = auto;
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
    // A hidden globe isn't turned: nobody would see it, the phone would still draw it.
    const sized = new ResizeObserver(([entry]) => {
      if (entry) shownRef.current = entry.contentRect.width > 0 && entry.contentRect.height > 0;
    });
    sized.observe(surface);
    return () => {
      for (const name of events) surface.removeEventListener(name, touched, options);
      sized.disconnect();
    };
  }, [surfaceRef]);

  // Touch screens: the first input anywhere on the page, and every scroll (a
  // scroll inside any element reaches the window in the capture phase).
  useEffect(() => {
    if (!isTouchScreen()) return;
    const page = pageRef.current;
    const interacted = () => {
      page.interacted = true;
    };
    const scrolled = () => {
      page.lastScrollAt = performance.now();
    };
    const inputs = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    const options = { capture: true, passive: true };
    for (const name of inputs) window.addEventListener(name, interacted, options);
    window.addEventListener("scroll", scrolled, options);
    return () => {
      for (const name of inputs) window.removeEventListener(name, interacted, options);
      window.removeEventListener("scroll", scrolled, options);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !enabled || reducedMotion) return;

    const touch = isTouchScreen();
    const frameMs = touch ? FRAME_MS_TOUCH : FRAME_MS;
    const page = pageRef.current;
    const tooSlow = slowStepWatch();
    let frame = 0;
    let timer = 0;
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

    // Turning: the next animation frame. Not turning: a look again later, no frames.
    const next = () => {
      frame = requestAnimationFrame(tick);
    };
    const later = () => {
      timer = window.setTimeout(() => tick(performance.now()), IDLE_POLL_MS);
    };

    const tick = (now: number) => {
      if (kickRef.current) {
        kickRef.current = false;
        startAt = now;
        lastInputRef.current = Number.NEGATIVE_INFINITY;
        beatAt = now + BEAT_MS / 3;
        page.interacted = true;
        manualRef.current = true;
      }
      if (heldRef.current || !shownRef.current || (!autoRef.current && !manualRef.current)) {
        last = 0;
        report(false);
        later();
        return;
      }
      // Someone else moves the camera (a flight, the user): wait, then pause before resuming.
      if (map.isMoving()) {
        startAt = now + START_DELAY_MS;
        last = 0;
        report(false);
        later();
        return;
      }
      // Paused while the visitor uses the globe; the first pulse soon after it turns again.
      const resumeAt = spinResumeAt({
        startAt,
        lastInputAt: lastInputRef.current,
        touch: touch ? page : null,
      });
      if (now < resumeAt) {
        beatAt = resumeAt + BEAT_MS / 2;
        last = 0;
        report(false);
        later();
        return;
      }
      report(true);
      if (now - last < frameMs) return next();
      // Touch screens: the expanded bottom sheet covers the globe (checked per step, not per frame).
      if (touch && document.querySelector('[data-sheet="expanded"]')) {
        last = now;
        return later();
      }
      const elapsed = last ? now - last : frameMs;
      last = now;
      // The device can't keep up: stop, as if the visitor pressed the button.
      if (tooSlow(elapsed)) {
        heldRef.current = true;
        manualRef.current = false;
        report(false);
        later();
        return;
      }
      const center = map.getCenter();
      map.jumpTo({ center: [spinLongitude(center.lng, elapsed), center.lat] }, SPIN_EVENT);
      if (now >= beatAt) {
        beatAt = now + BEAT_MS;
        onBeatRef.current?.();
      }
      next();
    };
    later();
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      setSpinning(false);
    };
  }, [mapRef, ready, enabled, reducedMotion]);

  /** The rotate button: start now, or stop until started again. */
  const toggle = useCallback(() => {
    if (spinning) {
      heldRef.current = true;
      manualRef.current = false;
    } else {
      heldRef.current = false;
      kickRef.current = true;
    }
  }, [spinning]);

  return { spinning, available: enabled && !reducedMotion, toggle };
}
