"use client";

import { type ReactNode, useCallback, useId, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Long text shown as a preview with a "Read more" button. The button appears
 * only when the text is actually longer than the preview; the full text is
 * always in the HTML (search engines, print).
 */
export function ReadMore({
  more,
  less,
  className,
  children,
}: {
  more: string;
  less: string;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);
  // Measured on every size change of the collapsed box; once long, it stays long.
  const measure = useCallback((element: HTMLDivElement | null) => {
    if (!element) return;
    const observer = new ResizeObserver(() =>
      setOverflows((long) => long || element.scrollHeight > element.clientHeight + 4),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const collapsed = !open && overflows;

  return (
    <div className={className}>
      <div
        id={id}
        ref={measure}
        className={cn(
          !open && "max-h-72 overflow-hidden print:max-h-none",
          collapsed &&
            "[mask-image:linear-gradient(to_bottom,black_65%,transparent)] print:[mask-image:none]",
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
          className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-[var(--color-accent)] px-4 text-[13.5px] font-semibold text-white transition hover:bg-[var(--color-accent-strong)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:outline-none print:hidden"
        >
          {open ? less : more}
        </button>
      ) : null}
    </div>
  );
}
