"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useMessages } from "@/components/i18n/LocaleProvider";
import { cn } from "@/lib/cn";
import { placePopup, type PopupPlacement } from "../popup-placement";
import type { MapPoint, MapPopup } from "../types";
import type { MapEngine } from "./PointMarker";
import { cssColor } from "./PointGlyph";
import { PopupContent } from "./PopupContent";

function measure(engine: MapEngine, point: MapPoint, popup: MapPopup): PopupPlacement {
  const box = engine.map.getContainer();
  const { x, y } = engine.map.project([point.lon, point.lat]);
  return placePopup({
    x,
    y,
    boxWidth: box.clientWidth,
    boxHeight: box.clientHeight,
    maxWidth: popup.maxWidth,
    offset: Math.max(point.size, 24) / 2 + 6,
  });
}

/**
 * The open point's popup, over the map: next to the point on a wide map
 * (following it as the map moves), docked along the bottom on a narrow one.
 * The pointer may travel from the point into it (to follow a link); Escape or
 * the close button shut it.
 */
export function PointPopup({
  engine,
  point,
  popup,
  id,
  onEnter,
  onLeave,
  onClose,
}: {
  engine: MapEngine;
  point: MapPoint;
  popup: MapPopup;
  id: string;
  onEnter: () => void;
  onLeave: () => void;
  onClose: () => void;
}) {
  const t = useMessages().mapVisual;
  const [placement, setPlacement] = useState(() => measure(engine, point, popup));

  useEffect(() => {
    const update = () => setPlacement(measure(engine, point, popup));
    engine.map.on("move", update);
    engine.map.on("resize", update);
    return () => {
      engine.map.off("move", update);
      engine.map.off("resize", update);
    };
  }, [engine, point, popup]);

  return (
    <div
      role="group"
      aria-label={point.label}
      onPointerEnter={onEnter}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") onLeave();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
      className={cn(
        "absolute z-10 overflow-auto rounded-xl",
        placement.docked && "inset-x-2 bottom-2 max-h-[60%]",
      )}
      style={
        placement.docked
          ? undefined
          : {
              left: placement.left,
              top: placement.top,
              width: placement.width,
              maxHeight: placement.maxHeight,
              transform: placement.above ? "translateY(-100%)" : undefined,
            }
      }
    >
      <div className="relative">
        <PopupContent point={point} popup={popup} id={id} />
        <button
          type="button"
          aria-label={t.closePopup}
          onClick={onClose}
          className="absolute top-1 right-1 grid size-8 place-items-center rounded-full opacity-70 transition hover:bg-black/10 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] pointer-coarse:size-(--touch-min)"
          style={{ color: cssColor(popup.color, "#16192b") }}
        >
          <X size={15} aria-hidden />
        </button>
      </div>
    </div>
  );
}
