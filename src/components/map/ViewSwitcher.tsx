"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Layers } from "lucide-react";
import { LEGEND_MAX_WIDTH, isFullPage, railKind } from "@/config/layout";
import { cn } from "@/lib/cn";
import { useMapState } from "./MapContext";

export interface ViewOption {
  id: string;
  label: string;
  shortLabel: string;
  caption: string;
  swatches: { color: string; label: string }[];
}

/**
 * Data layer switcher – the "World metrics" button (called "Encyclopedia view" in Figma).
 * The option list comes from the server, so adding an indicator to
 * scripts/indicators.config.mjs shows up here automatically.
 */
export default function ViewSwitcher({ options }: { options: ViewOption[] }) {
  const { view, setView } = useMapState();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const active = options.find((option) => option.id === view) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onClickAway = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, [open]);

  return (
    <div
      ref={wrapperRef}
      className="pointer-events-auto relative"
      // Esc closes the open list and returns to its button — and stops there, so
      // the content panel (which also listens for Esc) stays open.
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !open) return;
        event.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        // On phones an icon, so the mode switch keeps the row (the legend names the metric).
        className="glass glass-hover flex size-(--touch-min) items-center justify-center gap-2 rounded-full text-[13px] whitespace-nowrap text-white/90 transition sm:size-auto sm:min-h-(--touch-min) sm:px-4"
      >
        <Layers aria-hidden className="size-[18px] sm:hidden" />
        <span className="sr-only sm:not-sr-only">{active?.shortLabel}</span>
        <span
          aria-hidden
          className={cn("max-sm:hidden", open ? "rotate-180 transition" : "transition")}
        >
          ⌄
        </span>
      </button>

      {open ? (
        <div className="glass absolute top-12 right-0 z-40 w-72 overflow-hidden rounded-2xl p-1.5 shadow-2xl shadow-black/50">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setView(option.id);
                setOpen(false);
              }}
              className={`flex min-h-(--touch-min) w-full items-center gap-2.5 rounded-xl px-3 py-1.5 text-left text-[13px] transition ${
                option.id === view
                  ? "bg-white/15 text-white"
                  : "text-white/75 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className="flex shrink-0 overflow-hidden rounded-full">
                {option.swatches.length ? (
                  option.swatches
                    .slice(0, 4)
                    .map((swatch) => (
                      <span
                        key={swatch.label + swatch.color}
                        style={{ background: swatch.color }}
                        className="h-3 w-3"
                      />
                    ))
                ) : (
                  <span className="h-3 w-3 rounded-full bg-white/40" />
                )}
              </span>
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Legend at the bottom left, on one line with the map attribution (ⓘ) in the very corner.
 * Sits directly in the map container, not in the controls bar.
 */
export function MapLegend({ options }: { options: ViewOption[] }) {
  const { view } = useMapState();
  const pathname = usePathname();
  const option = options.find((item) => item.id === view) ?? options[0];
  if (!option || isFullPage(pathname)) return null;
  const rail = railKind(pathname);
  // On phones an open panel (bottom sheet) covers the bottom of the map.
  const hidden = rail !== "none" && "max-md:hidden";

  if (!option.swatches.length) {
    return (
      <p
        className={cn(
          "pointer-events-none absolute bottom-3.5 left-[42px] z-20 max-w-[calc(100vw-120px)] text-[11px] text-white/75 sm:max-w-[70vw]",
          LEGEND_MAX_WIDTH[rail],
          hidden,
        )}
      >
        {option.caption}
      </p>
    );
  }

  return (
    // Scale large enough to read over the globe: 31 rem long, 40 px colour bar, 15 px labels.
    // On phones it is smaller and leaves room for the attribution (left) and the
    // floating buttons (right).
    <div
      className={cn(
        "pointer-events-none absolute bottom-3.5 left-[42px] z-20 w-[min(calc(100vw-110px),31.25rem)]",
        LEGEND_MAX_WIDTH[rail],
        hidden,
      )}
    >
      <div className="flex overflow-hidden rounded-md">
        {option.swatches.map((swatch) => (
          <div key={swatch.label + swatch.color} className="min-w-0 flex-1">
            <div style={{ background: swatch.color }} className="h-6 sm:h-10" />
            <div className="mt-1 truncate text-center text-[11px] text-white/85 tabular-nums sm:mt-1.5 sm:text-[15px]">
              {swatch.label}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[12px] leading-snug text-white/75 sm:mt-2 sm:text-[15px]">
        {option.caption}
      </p>
    </div>
  );
}
