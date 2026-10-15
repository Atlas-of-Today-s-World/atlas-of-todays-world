"use client";

import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A timeline event's text cut after about ten lines, with a "More" button
 * (aria-expanded) that opens the rest and the sources under it. The cut is
 * measured in the browser — the server only guesses (`long`), so short texts
 * never show the button. Focus moving into the cut part (a link reached by
 * Tab) opens it, so nothing focusable stays hidden.
 */
export function TimelineText({
  children,
  long,
  more,
  less,
}: {
  children: ReactNode;
  /** The server's guess that the text runs over the cut (before it is measured). */
  long: boolean;
  more: string;
  less: string;
}) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(long);

  const measure = useCallback(() => {
    const el = ref.current;
    // Opened, the box has no limit to measure against: keep the button as it is.
    if (el && !open) setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  const folded = overflows && !open;
  return (
    <>
      <div
        id={id}
        ref={ref}
        onFocus={() => {
          if (folded) setOpen(true);
        }}
        className={cn(
          "text-[13px]",
          // Ten lines of 13 px text at 1.625 line height.
          !open && "max-h-[16.25em] overflow-hidden",
          folded && "[mask-image:linear-gradient(to_bottom,black_70%,transparent)]",
        )}
      >
        {children}
      </div>
      {overflows ? (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((value) => !value)}
          className="mt-1 inline-flex min-h-(--touch-min) items-center gap-1 text-[12.5px] font-semibold text-[var(--color-link)] hover:underline focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
        >
          {open ? less : more}
          <ChevronDown size={15} aria-hidden className={cn("transition", open && "rotate-180")} />
        </button>
      ) : null}
    </>
  );
}
