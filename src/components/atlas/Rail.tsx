"use client";

import { cva } from "class-variance-authority";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Children,
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";
import { useMessages } from "@/components/i18n/LocaleProvider";
import { format } from "@/lib/i18n/messages";

const track = cva(
  "panel-scroll -mx-1 flex snap-x snap-mandatory overflow-x-auto scroll-smooth px-1 pb-2 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none",
  {
    variants: {
      gap: { sm: "gap-2.5", md: "gap-3", lg: "gap-6" },
    },
    defaultVariants: { gap: "md" },
  },
);

/** Grid layout: two tiles per row, the rest wraps; the panel scrolls, never the block. */
const grid = cva("grid grid-cols-2", {
  variants: {
    gap: { sm: "gap-2.5", md: "gap-3", lg: "gap-6" },
  },
  defaultVariants: { gap: "md" },
});

const arrow = cva(
  "grid size-(--touch-min) place-items-center rounded-full border transition disabled:pointer-events-none disabled:opacity-30",
  {
    variants: {
      tone: {
        light:
          "border-[var(--color-line)] text-[var(--color-ink-soft)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]",
        dark: "border-white/25 text-white/80 hover:border-white/70 hover:text-white",
      },
    },
    defaultVariants: { tone: "light" },
  },
);

/**
 * The single Atlas carousel (ARCHITEKTURA 15.3, D2): timeline, entries, visuals,
 * sources and news. Items have their own width and `snap-start`; Rail handles
 * scrolling with arrows, keyboard (←/→, Home/End) and labels for screen readers.
 *
 * `layout="grid"` lays the same items out two per row with no horizontal
 * scrolling at all — for lists people scan rather than browse (entries).
 * Items then must not set their own width.
 *
 * `layout="pages"` shows one item at a time (items `w-full`, e.g. the
 * "Maps & charts" carousel): swipe or scroll with snapping as always, plus
 * previous / next arrows on every screen and a dot per item between them —
 * the dots say which one is shown and jump to any.
 */
export function Rail({
  label,
  children,
  gap,
  tone = "light",
  layout = "scroll",
  className,
}: {
  /** Screen-reader label ("Timeline", "News") — different for each carousel on the page. */
  label: string;
  children: ReactNode;
  gap?: "sm" | "md" | "lg";
  tone?: "light" | "dark";
  layout?: "scroll" | "grid" | "pages";
  className?: string;
}) {
  const t = useMessages().ui;
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  const [current, setCurrent] = useState(0);
  const pages = layout === "pages";
  const count = Children.count(children);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({
      start: el.scrollLeft <= 1,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1,
    });
    if (!pages) return;
    // The item whose left edge is nearest the track's: the one shown.
    const left = el.getBoundingClientRect().left;
    const offsets = Array.from(el.children, (child) =>
      Math.abs(child.getBoundingClientRect().left - left),
    );
    setCurrent(offsets.indexOf(Math.min(...offsets)));
  }, [pages]);

  /** Scrolls item `index` to the start of the track (snapping keeps it there). */
  const show = (index: number) => {
    const el = ref.current;
    const item = el?.children[index];
    if (!el || !item) return;
    const offset = item.getBoundingClientRect().left - el.getBoundingClientRect().left;
    el.scrollTo({ left: el.scrollLeft + offset });
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  const page = (direction: 1 | -1) => {
    if (pages) return show(Math.min(count - 1, Math.max(0, current + direction)));
    const el = ref.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.85 });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || event.target !== el) return;
    const moves: Record<string, () => void> = {
      ArrowRight: () => page(1),
      ArrowLeft: () => page(-1),
      Home: () => el.scrollTo({ left: 0 }),
      End: () => el.scrollTo({ left: el.scrollWidth }),
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      move();
    }
  };

  const scrollable = !(edges.start && edges.end);

  if (layout === "grid") {
    return (
      <div role="region" aria-label={label} className={cn("mt-5", className)}>
        <div className={grid({ gap })}>{children}</div>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      className={cn("mt-5", className)}
    >
      <div
        ref={ref}
        tabIndex={scrollable ? 0 : -1}
        onScroll={measure}
        onKeyDown={onKeyDown}
        className={track({ gap })}
      >
        {children}
      </div>
      {pages && count > 1 ? (
        <div className="mt-3 flex items-center justify-center gap-2">
          <button
            type="button"
            aria-label={format(t.railPrevious, { label })}
            disabled={current === 0}
            onClick={() => page(-1)}
            className={arrow({ tone })}
          >
            <ChevronLeft size={18} aria-hidden />
          </button>
          <ul className="flex flex-wrap items-center justify-center">
            {Array.from({ length: count }, (_, index) => (
              <li key={index}>
                {/* A 24 px target around an 8 px dot (WCAG 2.5.8). */}
                <button
                  type="button"
                  aria-label={format(t.railPage, {
                    label,
                    number: String(index + 1),
                    total: String(count),
                  })}
                  aria-current={index === current ? "true" : undefined}
                  onClick={() => show(index)}
                  className="group grid size-6 place-items-center rounded-full focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "size-2 rounded-full transition",
                      index === current
                        ? "scale-125 bg-[var(--color-accent)]"
                        : "bg-[var(--color-line)] group-hover:bg-[var(--color-ink-muted)]",
                    )}
                  />
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            aria-label={format(t.railNext, { label })}
            disabled={current === count - 1}
            onClick={() => page(1)}
            className={arrow({ tone })}
          >
            <ChevronRight size={18} aria-hidden />
          </button>
          <p className="sr-only" aria-live="polite">
            {format(t.railShown, { number: String(current + 1), total: String(count) })}
          </p>
        </div>
      ) : null}
      {scrollable && !pages ? (
        <div className="mt-2 hidden justify-end gap-2 md:flex">
          <button
            type="button"
            aria-label={format(t.railPrevious, { label })}
            disabled={edges.start}
            onClick={() => page(-1)}
            className={arrow({ tone })}
          >
            <ChevronLeft size={18} aria-hidden />
          </button>
          <button
            type="button"
            aria-label={format(t.railNext, { label })}
            disabled={edges.end}
            onClick={() => page(1)}
            className={arrow({ tone })}
          >
            <ChevronRight size={18} aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  );
}
