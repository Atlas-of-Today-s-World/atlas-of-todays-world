"use client";

import { useEffect, useRef, useState } from "react";

/** How far below (or beside) the viewport a frame starts loading. */
const NEAR_VIEWPORT = "300px";

/**
 * True once the element comes near the viewport, and then for good: a
 * carousel's frames are created only when their slide is about to show.
 */
export function useNearViewport<T extends Element>() {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setNear(true);
      },
      { rootMargin: NEAR_VIEWPORT },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [near]);

  return [ref, near] as const;
}
