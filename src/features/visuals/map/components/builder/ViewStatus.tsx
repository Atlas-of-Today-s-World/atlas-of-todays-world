"use client";

import { Crosshair, RotateCcw, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { sameFraming } from "../../builder-state";
import type { MapBounds, MapView } from "../../types";

/** The framed box in plain numbers (west, south, east, north). */
export const formatBounds = (bounds: MapBounds) =>
  bounds.map((value) => value.toFixed(1)).join(", ");

function describe(view: MapView): string {
  switch (view.mode) {
    case "bounds":
      return "the view you leave the map at (free view)";
    case "countries":
      if (!view.countries.length) return "the area last framed (no countries chosen yet)";
      return view.countries.length === 1
        ? "the framed country"
        : `the ${view.countries.length} framed countries`;
    case "region":
      return view.region ? view.region.name : "the framed region";
  }
}

/**
 * Above the builder's map: what readers will see when the map opens, and
 * whether that framing is saved yet. In a free view the map's current view
 * *is* the framing (saved with the visual); with countries or a region
 * framed, moving the map only looks around — the editor can adopt that view
 * or go back. "Reset to saved view" brings the last saved framing back.
 */
export function ViewStatus({
  view,
  saved,
  moved,
  disabled,
  onUseView,
  onBackToFraming,
  onResetToSaved,
}: {
  view: MapView;
  /** The framing as last saved; null for a map not saved yet. */
  saved: MapView | null;
  /** The editor moved the map away from a countries or region framing. */
  moved: boolean;
  /** Preview as a reader: nothing to change. */
  disabled: boolean;
  onUseView: () => void;
  onBackToFraming: () => void;
  onResetToSaved: () => void;
}) {
  const unchanged = saved ? sameFraming(view, saved) : false;
  return (
    <div
      data-testid="map-view-status"
      className="grid gap-2 rounded-xl border border-[var(--color-line)] px-3 py-2 text-[12.5px]"
    >
      <p className="flex flex-wrap items-center gap-2 text-[var(--color-ink-soft)]">
        <span>
          Readers see <strong className="text-[var(--color-ink)]">{describe(view)}</strong>
          <span className="text-[var(--color-ink-muted)]"> · {formatBounds(view.bounds)}</span>
        </span>
        {unchanged ? (
          <Badge tone="success">Saved view</Badge>
        ) : (
          <Badge tone="warning">
            {saved ? "Changed — saved when you save the map" : "Saved when you add the map"}
          </Badge>
        )}
      </p>
      {saved && !unchanged ? (
        <p className="text-[12px] text-[var(--color-ink-muted)]">
          Saved view: {describe(saved)} · {formatBounds(saved.bounds)}
        </p>
      ) : null}
      {moved ? (
        <p role="status" className="text-[12px] text-[var(--color-warning)]">
          You moved the map. Readers still see {describe(view)} unless you use this view.
        </p>
      ) : null}
      {!disabled && (moved || (saved && !unchanged)) ? (
        <div className="flex flex-wrap gap-2">
          {moved ? (
            <>
              <Button variant="outline" size="sm" onClick={onUseView}>
                <Crosshair size={15} aria-hidden />
                Use this view
              </Button>
              <Button variant="outline" size="sm" onClick={onBackToFraming}>
                <Undo2 size={15} aria-hidden />
                Back to the framing
              </Button>
            </>
          ) : null}
          {saved && !unchanged ? (
            <Button variant="outline" size="sm" onClick={onResetToSaved}>
              <RotateCcw size={15} aria-hidden />
              Reset to saved view
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
