"use client";

import { DESKTOP_MIN_PX } from "@/config/layout";

/** Longest wait for the `load` event: a slow photo or embed must not keep the globe away. */
const LOAD_TIMEOUT_MS = 4000;
/** Longest wait for an idle moment (after the page has loaded) before the globe starts anyway. */
const IDLE_TIMEOUT_MS = 1500;

/** Taps here are the page's own (panel, header), not a wish to use the globe. */
const NOT_THE_GLOBE = "[data-content-rail], header";

export interface GlobeStartGate {
  /** The visitor wants the globe now: stop waiting for intent (idempotent). */
  release(): void;
  /** Unmounted: nothing more starts. */
  cancel(): void;
}

/**
 * When the globe (AtlasGlobe) may start. MapLibre is ~1 MB of JavaScript and its
 * first frames are seconds of main-thread work on a phone, so it waits for the page:
 *
 * 1. the `load` event — the panel's text and its photo (the Largest Contentful
 *    Paint) are painted first, and countries.geo.json, the library and the tiles
 *    are only requested once the globe really starts;
 * 2. an idle moment, so hydration and the first input are never blocked;
 * 3. on a phone with a panel open (`deferred()`), the visitor: the bottom sheet
 *    covers most of the globe, so it starts on the first tap outside the panel
 *    (the strip of map above it, the map's buttons), once the panel closes or
 *    the window grows to the desktop layout (`release()` / the media query);
 * 4. a size: the corner window is left out on phones.
 */
export function scheduleGlobeStart({
  container,
  deferred,
  onWaiting,
  start,
}: {
  container: HTMLElement;
  /** Read after the idle moment: whether to wait for the visitor (a phone with a panel open). */
  deferred: () => boolean;
  /** The globe waits for the visitor (true), or no longer does (false). */
  onWaiting: (waiting: boolean) => void;
  start: () => void;
}): GlobeStartGate {
  let cancelled = false;
  const cleanups: (() => void)[] = [];
  let released = false;
  let onRelease: (() => void) | undefined;
  const release = () => {
    if (released) return;
    released = true;
    onRelease?.();
  };

  const afterLoad = () =>
    new Promise<void>((resolve) => {
      if (document.readyState === "complete") return resolve();
      const loaded = () => resolve();
      window.addEventListener("load", loaded, { once: true });
      const timer = window.setTimeout(loaded, LOAD_TIMEOUT_MS);
      cleanups.push(() => {
        window.removeEventListener("load", loaded);
        window.clearTimeout(timer);
      });
    });

  const afterIdle = () =>
    new Promise<void>((resolve) => {
      if (typeof window.requestIdleCallback === "function") {
        const id = window.requestIdleCallback(() => resolve(), { timeout: IDLE_TIMEOUT_MS });
        cleanups.push(() => window.cancelIdleCallback(id));
      } else {
        const id = window.setTimeout(resolve, 1);
        cleanups.push(() => window.clearTimeout(id));
      }
    });

  const afterIntent = () =>
    new Promise<void>((resolve) => {
      if (released) return resolve();
      onRelease = resolve;
      const tapped = (event: Event) => {
        if (event.target instanceof Element && event.target.closest(NOT_THE_GLOBE)) return;
        release();
      };
      const desktop = window.matchMedia(`(min-width: ${DESKTOP_MIN_PX}px)`);
      const widened = () => {
        if (desktop.matches) release();
      };
      const options = { capture: true, passive: true };
      window.addEventListener("pointerdown", tapped, options);
      desktop.addEventListener("change", widened);
      cleanups.push(() => {
        window.removeEventListener("pointerdown", tapped, options);
        desktop.removeEventListener("change", widened);
      });
    });

  const afterSize = () =>
    new Promise<void>((resolve) => {
      const sized = () => container.clientWidth > 0 && container.clientHeight > 0;
      if (sized()) return resolve();
      const observer = new ResizeObserver(() => {
        if (!sized()) return;
        observer.disconnect();
        resolve();
      });
      observer.observe(container);
      cleanups.push(() => observer.disconnect());
    });

  void (async () => {
    await afterLoad();
    if (cancelled) return;
    await afterIdle();
    if (cancelled) return;
    if (!released && deferred()) {
      onWaiting(true);
      await afterIntent();
      if (cancelled) return;
      onWaiting(false);
    }
    await afterSize();
    if (!cancelled) start();
  })();

  return {
    release,
    cancel() {
      cancelled = true;
      for (const cleanup of cleanups) cleanup();
    },
  };
}
