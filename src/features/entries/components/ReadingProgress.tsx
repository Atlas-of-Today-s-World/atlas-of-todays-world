"use client";

import { useRef } from "react";
import { UNDER_HEADER_BAR } from "@/config/layout";
import { cn } from "@/lib/cn";
import { useScrollFrame } from "@/lib/use-scroll-frame";

/**
 * Thin accent line right under the header bar showing how far the page (with
 * the open subtopic) has been read. Purely visual (`aria-hidden`); it follows
 * the scroll without any transition, so reduced motion needs nothing extra.
 * The sticky holder has no height, so the page below does not move.
 */
export function ReadingProgress() {
  const holder = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);

  useScrollFrame(holder, (scroller) => {
    const range = scroller.scrollHeight - scroller.clientHeight;
    const share = range > 0 ? Math.min(1, Math.max(0, scroller.scrollTop / range)) : 0;
    // Written straight to the element: no React render on every frame.
    if (bar.current) bar.current.style.transform = `scaleX(${share})`;
  });

  return (
    <div ref={holder} aria-hidden className={cn("sticky z-40 h-0 print:hidden", UNDER_HEADER_BAR)}>
      <div
        ref={bar}
        className="absolute inset-x-0 top-0 h-1 origin-left [transform:scaleX(0)] bg-[var(--color-accent)]"
      />
    </div>
  );
}
