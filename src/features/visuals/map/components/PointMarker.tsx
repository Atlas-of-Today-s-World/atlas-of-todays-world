"use client";

import type * as MapLibre from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { useLatest } from "@/lib/use-latest";
import { pointPosition } from "../geo";
import type { MapPoint } from "../types";
import { PointGlyph } from "./PointGlyph";

/** A click this soon after a drag ended is the drag's own mouseup. */
const CLICK_AFTER_DROP_MS = 300;

export interface MapEngine {
  map: MapLibre.Map;
  lib: typeof MapLibre;
}

/**
 * One point on the map: MapLibre keeps an HTML marker in place, React draws
 * its content into it (a portal). The content is a real button — focusable,
 * named by the point's label, opening its popup — so the map's points work
 * from the keyboard and with a screen reader. In the builder it can be dragged.
 */
export function PointMarker({
  engine,
  point,
  dark,
  draggable,
  selected,
  popupId,
  expanded,
  onActivate,
  onHover,
  onLeave,
  onClose,
  onMove,
}: {
  engine: MapEngine;
  point: MapPoint;
  /** Satellite background: the label is white on a dark halo. */
  dark: boolean;
  draggable: boolean;
  selected: boolean;
  /** Id of the popup this point opens (none without a popup). */
  popupId: string | null;
  expanded: boolean;
  onActivate: (id: string) => void;
  onHover: (id: string) => void;
  onLeave: (id: string) => void;
  onClose: () => void;
  onMove: (id: string, position: { lat: number; lon: number }) => void;
}) {
  // The marker element exists only in the browser (points render once the map has loaded).
  const [element] = useState(() => document.createElement("div"));
  const markerRef = useRef<MapLibre.Marker | null>(null);
  const latest = useLatest({ point, onMove, onClose });
  // When the last drag ended: the click that ends a drag only drops the point.
  const droppedAt = useRef(0);

  useEffect(() => {
    const { lon, lat } = latest.current.point;
    const marker = new engine.lib.Marker({ element, anchor: "center" })
      .setLngLat([lon, lat])
      .addTo(engine.map);
    markerRef.current = marker;
    return () => {
      marker.remove();
      markerRef.current = null;
    };
  }, [engine, element, latest]);

  useEffect(() => {
    markerRef.current?.setLngLat([point.lon, point.lat]);
  }, [point.lon, point.lat]);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;
    marker.setDraggable(draggable);
    if (!draggable) return;
    // A popup open under the pointer would swallow the drag's mouse events.
    const start = () => latest.current.onClose();
    const end = () => {
      droppedAt.current = Date.now();
      const { lng, lat } = marker.getLngLat();
      latest.current.onMove(latest.current.point.id, pointPosition(lng, lat));
    };
    marker.on("dragstart", start);
    marker.on("dragend", end);
    return () => {
      marker.off("dragstart", start);
      marker.off("dragend", end);
    };
  }, [draggable, latest]);

  // The open or selected point is drawn over its neighbours.
  const raised = expanded || selected;
  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;
    if (raised) marker.addClassName("z-2");
    else marker.removeClassName("z-2");
  }, [raised]);

  const hit = Math.max(point.size, 24);
  return createPortal(
    <div className="relative">
      <button
        type="button"
        aria-label={point.label}
        aria-expanded={popupId ? expanded : undefined}
        aria-controls={popupId && expanded ? popupId : undefined}
        onClick={() => {
          if (Date.now() - droppedAt.current < CLICK_AFTER_DROP_MS) return;
          onActivate(point.id);
        }}
        onPointerEnter={(event) => {
          // In the builder a hover popup would get in the way of dragging.
          if (event.pointerType === "mouse" && !draggable) onHover(point.id);
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") onLeave(point.id);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && expanded) {
            event.stopPropagation();
            onClose();
          }
        }}
        className={cn(
          "grid place-items-center rounded-full outline-offset-2 focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] pointer-coarse:min-h-8 pointer-coarse:min-w-8",
          draggable
            ? "cursor-grab active:cursor-grabbing"
            : popupId
              ? "cursor-pointer"
              : "cursor-default",
          selected && "outline-2 outline-[var(--color-accent)]",
        )}
        style={{ width: hit, height: hit }}
      >
        <PointGlyph color={point.color} size={point.size} icon={point.icon} pulse={point.pulse} />
      </button>
      {point.showLabel ? (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute top-1/2 left-full ml-1 -translate-y-1/2 text-[12px] font-semibold whitespace-nowrap",
            dark
              ? "text-white [text-shadow:0_0_3px_rgb(6_10_20),0_0_2px_rgb(6_10_20)]"
              : "text-[var(--color-ink)] [text-shadow:0_0_3px_white,0_0_2px_white]",
          )}
        >
          {point.label}
        </span>
      ) : null}
    </div>,
    element,
  );
}
