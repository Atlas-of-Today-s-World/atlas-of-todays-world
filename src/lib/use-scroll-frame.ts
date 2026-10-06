"use client";

import { type RefObject, useEffect } from "react";
import { useLatest } from "./use-latest";

/** Nearest ancestor that scrolls on its own (FullPage), else the document. */
function scrollParent(element: HTMLElement): HTMLElement {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === "auto" || overflowY === "scroll") return node;
  }
  return document.documentElement;
}

/**
 * Calls `onFrame` with the scroll container of `ref` once on mount and then at
 * most once per animation frame while it scrolls or the window resizes. The
 * listeners are passive; full-width pages scroll their own frame, not the
 * window, so the container is looked up from the element.
 */
export function useScrollFrame(
  ref: RefObject<HTMLElement | null>,
  onFrame: (scroller: HTMLElement) => void,
) {
  const latest = useLatest(onFrame);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const scroller = scrollParent(element);
    // The document's scroll events fire on window, an element's on the element.
    const target: HTMLElement | Window = scroller === document.documentElement ? window : scroller;
    let frame = 0;
    const update = () => {
      frame = 0;
      latest.current(scroller);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    target.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      target.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [ref, latest]);
}
