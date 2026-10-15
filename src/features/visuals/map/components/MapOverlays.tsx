"use client";

import { ChevronDown, Minus, Plus, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useMessages } from "@/components/i18n/LocaleProvider";
import { cn } from "@/lib/cn";
import type { MapCorner, MapLegend } from "../types";
import { PointGlyph } from "./PointGlyph";

const CORNER_CLASS: Record<MapCorner, string> = {
  "top-left": "top-2 left-2",
  "top-right": "top-2 right-2",
  "bottom-left": "bottom-2 left-2",
  "bottom-right": "bottom-2 right-2",
};

/**
 * The map's legend in its corner: a title that folds it away (the reader
 * decides; the text below the toggle stays in the DOM order of the map) and
 * one row per item — a colour, an icon or both, and the label.
 */
export function LegendOverlay({
  legend,
  startFolded = false,
}: {
  legend: MapLegend;
  startFolded?: boolean;
}) {
  const t = useMessages().mapVisual;
  const [open, setOpen] = useState(!startFolded);
  if (!legend.visible || !legend.items.length) return null;
  const title = legend.title || t.legend;
  return (
    <div
      className={cn(
        "absolute z-3 max-w-[min(18rem,calc(100%-4.5rem))] rounded-xl bg-white/92 text-[12.5px] text-[var(--color-ink)] shadow-md ring-1 ring-black/10 backdrop-blur-sm",
        CORNER_CLASS[legend.position],
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-label={open ? `${title} — ${t.hideLegend}` : `${title} — ${t.showLegend}`}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-8 w-full items-center justify-between gap-2 rounded-xl px-3 text-left font-semibold focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] pointer-coarse:min-h-(--touch-min)"
      >
        {title}
        <ChevronDown
          size={14}
          aria-hidden
          className={cn("shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>
      {open ? (
        <ul className="grid max-h-56 gap-1.5 overflow-auto px-3 pb-2.5">
          {legend.items.map((item, index) => (
            <li key={index} className="flex items-center gap-2">
              <span className="grid w-5 shrink-0 place-items-center">
                <PointGlyph color={item.color} size={16} icon={item.icon} />
              </span>
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Zoom and "back to the original view", in the corner the legend doesn't use. */
export function ZoomOverlay({
  corner,
  onZoomIn,
  onZoomOut,
  onReset,
}: {
  corner: MapCorner;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}) {
  const t = useMessages().mapVisual;
  const buttons = [
    { label: t.zoomIn, icon: Plus, run: onZoomIn },
    { label: t.zoomOut, icon: Minus, run: onZoomOut },
    { label: t.resetView, icon: RotateCcw, run: onReset },
  ];
  return (
    <div
      className={cn(
        "absolute z-3 grid overflow-hidden rounded-xl bg-white shadow-md ring-1 ring-black/10",
        CORNER_CLASS[corner],
      )}
    >
      {buttons.map(({ label, icon: Icon, run }) => (
        <button
          key={label}
          type="button"
          title={label}
          aria-label={label}
          onClick={run}
          className="grid size-8 place-items-center text-[var(--color-ink-soft)] transition hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-ink)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-accent)] pointer-coarse:size-(--touch-min)"
        >
          <Icon size={16} aria-hidden />
        </button>
      ))}
    </div>
  );
}
