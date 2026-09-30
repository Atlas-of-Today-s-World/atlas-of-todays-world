"use client";

import { useEffect, useRef, useState } from "react";
import { useMapState } from "./MapContext";

export interface ViewOption {
  id: string;
  label: string;
  shortLabel: string;
  caption: string;
  swatches: { color: string; label: string }[];
}

/**
 * Přepínač datových vrstev – ve Figmě tlačítko "Encyclopedia view".
 * Seznam voleb chodí ze serveru, takže přidání indikátoru do
 * scripts/indicators.config.mjs se tady projeví samo.
 */
export default function ViewSwitcher({ options }: { options: ViewOption[] }) {
  const { view, setView } = useMapState();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

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
    <div ref={wrapperRef} className="pointer-events-auto relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="glass glass-hover flex items-center gap-2 rounded-full px-4 py-2 text-[13px] whitespace-nowrap text-white/90 transition"
      >
        {active.shortLabel}
        <span aria-hidden className={open ? "rotate-180 transition" : "transition"}>
          ⌄
        </span>
      </button>

      {open ? (
        <div className="glass absolute top-11 right-0 z-40 w-72 overflow-hidden rounded-2xl p-1.5 shadow-2xl shadow-black/50">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setView(option.id);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] transition ${
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

/** Legenda vlevo dole. Sedí přímo v mapovém kontejneru, ne v liště ovládání. */
export function MapLegend({ options }: { options: ViewOption[] }) {
  const { view } = useMapState();
  const option = options.find((item) => item.id === view) ?? options[0];

  if (!option.swatches.length) {
    return (
      <p className="pointer-events-none absolute bottom-5 left-5 z-20 max-w-[70vw] text-[11px] text-white/55">
        {option.caption}
      </p>
    );
  }

  return (
    <div className="pointer-events-none absolute bottom-5 left-5 z-20 w-[min(80vw,24rem)]">
      <div className="flex overflow-hidden rounded-md">
        {option.swatches.map((swatch) => (
          <div key={swatch.label + swatch.color} className="flex-1">
            <div style={{ background: swatch.color }} className="h-2.5" />
            <div className="mt-1 text-center text-[10px] text-white/65">{swatch.label}</div>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[10.5px] leading-snug text-white/55">{option.caption}</p>
    </div>
  );
}
