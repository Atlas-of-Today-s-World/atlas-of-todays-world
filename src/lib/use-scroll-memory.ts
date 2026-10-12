"use client";

import { type RefObject, useEffect, useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const STORAGE_PREFIX = "atlas:scroll:";
/** Writes to sessionStorage at most this often while the visitor scrolls. */
const SAVE_EVERY_MS = 150;
/** After Back, the restore keeps trying this long while the page streams in. */
const RESTORE_FOR_MS = 1500;

/** The address a scroll position belongs to (the hash is a target, not a page). */
const currentKey = () => location.pathname + location.search;
const pathOf = (key: string) => key.split("?")[0];

function load(key: string): number | null {
  try {
    const value = sessionStorage.getItem(STORAGE_PREFIX + key);
    const top = value === null ? NaN : Number(value);
    return Number.isFinite(top) ? top : null;
  } catch {
    // Storage blocked (privacy settings, sandboxed preview): nothing to restore.
    return null;
  }
}

function save(key: string, top: number) {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + key, String(Math.round(top)));
  } catch {
    // Storage full or blocked: the page just won't remember this position.
  }
}

/**
 * Where the last Back / Forward led, with the position remembered for it —
 * read right away, before the old page's last scroll events can overwrite it.
 * Module-wide: the container that restores may mount only after the popstate.
 */
let poppedTo: { key: string; top: number | null } | null = null;
let listening = false;
let documentChecked = false;

function listenForPopstate() {
  if (listening) return;
  listening = true;
  // Capture: runs before the router reacts to the same event.
  window.addEventListener(
    "popstate",
    () => {
      const key = currentKey();
      poppedTo = { key, top: load(key) };
    },
    { capture: true },
  );
}

/** True once, for the first container, if the document itself was opened by Back / Forward or a reload. */
function documentReturnedTo(key: string): boolean {
  if (documentChecked) return false;
  documentChecked = true;
  const entry = performance.getEntriesByType?.("navigation")[0] as
    PerformanceNavigationTiming | undefined;
  if (!entry || (entry.type !== "back_forward" && entry.type !== "reload")) return false;
  const url = new URL(entry.name);
  return url.pathname + url.search === key;
}

/** The position to restore on arriving at `key`, if the visitor came back to it. */
function restoreTarget(key: string): number | null {
  const popped = poppedTo;
  poppedTo = null;
  if (popped?.key === key) return popped.top;
  return documentReturnedTo(key) ? load(key) : null;
}

/**
 * Remembers how far the scroll container `ref` was scrolled on each address
 * (pathname + query, in sessionStorage) and puts it back when the visitor
 * returns with Back / Forward. The browser and Next.js restore only the
 * window's scroll, but full-width pages (FullPage) and map panels
 * (ContentRail) scroll their own container — without this, Back from a topic
 * lands at the top of the list. A fresh link navigation starts at the top (or
 * at its #target, which Next.js scrolls to), also in a container that stays
 * mounted across pages. `enabled: false` for stand-ins (loading skeletons),
 * which must neither take the position nor overwrite it.
 */
export function useScrollMemory(ref: RefObject<HTMLElement | null>, enabled = true) {
  const pathname = usePathname();
  // The address the container shows and how far it was last scrolled there.
  // The address changes only in the commit that swaps the page, so a scroll
  // event never files the new page's position under the old address.
  const key = useRef<string | null>(null);
  const top = useRef(0);

  // Remember while scrolling (throttled), and once more when the container goes.
  useEffect(() => {
    const scroller = ref.current;
    if (!scroller || !enabled) return;
    listenForPopstate();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const flush = () => {
      clearTimeout(timer);
      timer = undefined;
      if (key.current) save(key.current, top.current);
    };
    const onScroll = () => {
      // Only the query changed (a filter, not a new page): file under it from now on.
      if (key.current && pathOf(key.current) === location.pathname) key.current = currentKey();
      top.current = scroller.scrollTop;
      timer ??= setTimeout(flush, SAVE_EVERY_MS);
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      // The last known position: the element may already be detached here.
      flush();
    };
  }, [ref, enabled]);

  // On every new page: file the old position, then restore it or start at the
  // top. A layout effect, so the position is set before the page paints.
  useLayoutEffect(() => {
    const scroller = ref.current;
    if (!scroller || !enabled) return;
    const next = currentKey();
    if (key.current === next) return;
    const previous = key.current;
    if (previous) save(previous, top.current);
    key.current = next;

    const target = restoreTarget(next);
    if (target === null) {
      // The container stays mounted across pages (FullPage): don't carry the
      // old page's position over. A #target was already scrolled to.
      if (previous && !location.hash) scroller.scrollTop = 0;
      top.current = scroller.scrollTop;
      return;
    }

    // The page may still be streaming in and too short to scroll that far:
    // keep trying for a moment, unless the visitor starts scrolling themselves.
    const until = performance.now() + RESTORE_FOR_MS;
    let frame = 0;
    const step = () => {
      scroller.scrollTop = target;
      top.current = scroller.scrollTop;
      if (Math.abs(scroller.scrollTop - target) > 1 && performance.now() < until) {
        frame = requestAnimationFrame(step);
      }
    };
    const stop = () => cancelAnimationFrame(frame);
    const intents = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
    intents.forEach((type) => scroller.addEventListener(type, stop, { passive: true }));
    step();
    return () => {
      stop();
      intents.forEach((type) => scroller.removeEventListener(type, stop));
    };
  }, [ref, enabled, pathname]);
}
