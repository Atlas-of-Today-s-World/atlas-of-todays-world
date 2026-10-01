"use client";

import { cva } from "class-variance-authority";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";
import { useMessages } from "@/components/i18n/LocaleProvider";
import { format } from "@/features/i18n/messages";

const track = cva(
  "panel-scroll -mx-1 flex snap-x snap-mandatory overflow-x-auto scroll-smooth px-1 pb-2 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none",
  {
    variants: {
      gap: { sm: "gap-2.5", md: "gap-3", lg: "gap-6" },
    },
    defaultVariants: { gap: "md" },
  },
);

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
 * Jediný karusel Atlasu (ARCHITEKTURA 15.3, D2): časová osa, hesla, vizuály,
 * zdroje i novinky. Položky mají vlastní šířku a `snap-start`; Rail se stará
 * o posun šipkami, klávesnicí (←/→, Home/End) a o popisky pro čtečky.
 */
export function Rail({
  label,
  children,
  gap,
  tone = "light",
  className,
}: {
  /** Popisek pro čtečku („Timeline", „News") — každý karusel na stránce jiný. */
  label: string;
  children: ReactNode;
  gap?: "sm" | "md" | "lg";
  tone?: "light" | "dark";
  className?: string;
}) {
  const t = useMessages().ui;
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({
      start: el.scrollLeft <= 1,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1,
    });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  const page = (direction: 1 | -1) => {
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
      {scrollable ? (
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
