"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type * as MapLibre from "maplibre-gl";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { foldAttribution } from "@/components/map/attribution";
import { loadMapLibre } from "@/components/map/maplibre";
import { useMessages } from "@/components/i18n/LocaleProvider";
import { cn } from "@/lib/cn";
import { useLatest } from "@/lib/use-latest";
import { toLngLatBounds } from "../geo";
import { DOCK_BELOW_PX } from "../popup-placement";
import { buildVisualStyle, VISUAL_LAYERS } from "../style";
import type { MapCorner, MapSpec } from "../types";
import { LegendOverlay, ZoomOverlay } from "./MapOverlays";
import { PointMarker, type MapEngine } from "./PointMarker";
import { PointPopup } from "./PointPopup";

/** What the builder adds to the reader's map. */
export interface MapEditing {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMovePoint: (id: string, position: { lat: number; lon: number }) => void;
  /** A click on the map itself (not on a point), with the country under it. */
  onMapClick: (event: { lat: number; lon: number; iso3: string | null }) => void;
  /** The map once it has loaded ("Use this view" reads its bounds). */
  onReady: (map: MapLibre.Map) => void;
}

/** Hovering off a point waits this long, so the pointer can move into its popup. */
const HOVER_CLOSE_MS = 250;
/** A sharp map on a retina screen without drawing 9× the pixels of a 3× phone. */
const MAX_PIXEL_RATIO = 2;

/** The zoom buttons sit at the top, on the side the legend doesn't use. */
function zoomCorner(spec: MapSpec): MapCorner {
  return spec.legend.visible && spec.legend.position === "top-right" ? "top-left" : "top-right";
}

/**
 * The map itself — one component for the public renderer and the builder's
 * live preview, so both look and behave the same. It creates MapLibre once
 * (from public/, components/map/maplibre.ts), keeps the style, view, points,
 * popup and legend in step with the spec, and reports failures (no WebGL).
 */
export default function MapCanvas({
  spec,
  editing,
  onFail,
}: {
  spec: MapSpec;
  editing?: MapEditing;
  onFail: () => void;
}) {
  const t = useMessages().mapVisual;
  const containerRef = useRef<HTMLDivElement>(null);
  const [engine, setEngine] = useState<MapEngine | null>(null);
  // A phone-sized map: the legend starts folded so the map stays visible.
  const [narrow, setNarrow] = useState(false);
  const [open, setOpen] = useState<{ id: string; pinned: boolean } | null>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  // The reader moved the map: a resize keeps their view instead of reframing.
  const movedByReader = useRef(false);
  const popupBase = useId();
  const latest = useLatest({ spec, editing, onFail });
  const editable = Boolean(editing);

  // --- the map, created once ---
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let created: MapLibre.Map | undefined;
    loadMapLibre()
      .then((lib) => {
        if (cancelled) return;
        const first = latest.current.spec;
        const map = new lib.Map({
          container,
          style: buildVisualStyle(first.view, first.countries),
          bounds: toLngLatBounds(first.view.bounds),
          attributionControl: false,
          // In an article the page scrolls on: zoom takes Ctrl/⌘ + wheel or two fingers.
          cooperativeGestures: !latest.current.editing,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          maxPitch: 0,
          pixelRatio: Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO),
        });
        created = map;
        map.addControl(new lib.AttributionControl({ compact: true }), "bottom-right");
        foldAttribution(container);
        map.on("error", (event: MapLibre.ErrorEvent) => {
          console.error("[map-visual]", event.error?.message ?? event);
        });
        map.on("load", () => {
          if (cancelled) return;
          setNarrow(container.clientWidth < DOCK_BELOW_PX);
          setEngine({ map, lib });
          latest.current.editing?.onReady(map);
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error("[map-visual]", error instanceof Error ? error.message : error);
        latest.current.onFail();
      });
    return () => {
      cancelled = true;
      window.clearTimeout(closeTimer.current);
      created?.remove();
    };
  }, [latest]);

  // --- background, projection and highlighted countries ---
  const { basemap, projection, labels, bounds } = spec.view;
  const style = useMemo(
    () => buildVisualStyle({ basemap, projection, labels }, spec.countries),
    [basemap, projection, labels, spec.countries],
  );
  useEffect(() => {
    if (!engine) return;
    engine.map.setStyle(style);
    engine.map.setProjection({ type: projection });
  }, [engine, style, projection]);

  // --- the framed view (again whenever the spec's view changes) ---
  useEffect(() => {
    if (!engine) return;
    movedByReader.current = false;
    engine.map.fitBounds(toLngLatBounds(bounds), { padding: 0, duration: 0 });
  }, [engine, bounds]);

  // --- readers: scroll-friendly gestures, and the view kept framed as the box resizes ---
  useEffect(() => {
    if (!engine) return;
    const { map } = engine;
    if (editable) map.cooperativeGestures.disable();
    else map.cooperativeGestures.enable();
    if (editable) return;
    const onMoveStart = (event: { originalEvent?: unknown }) => {
      if (event.originalEvent) movedByReader.current = true;
    };
    const onResize = () => {
      if (movedByReader.current) return;
      map.fitBounds(toLngLatBounds(latest.current.spec.view.bounds), { padding: 0, duration: 0 });
    };
    map.on("movestart", onMoveStart);
    map.on("resize", onResize);
    return () => {
      map.off("movestart", onMoveStart);
      map.off("resize", onResize);
    };
  }, [engine, editable, latest]);

  // --- a click on the map: closes the popup; in the builder, adds a point or toggles a country ---
  useEffect(() => {
    if (!engine) return;
    const { map } = engine;
    const onClick = (event: MapLibre.MapMouseEvent) => {
      const target = event.originalEvent.target;
      if (target instanceof Element && target.closest(".maplibregl-marker")) return;
      setOpen(null);
      const handler = latest.current.editing?.onMapClick;
      if (!handler) return;
      const [country] = map.queryRenderedFeatures(event.point, { layers: [VISUAL_LAYERS.land] });
      const iso3 = country?.properties?.iso3;
      handler({
        lat: event.lngLat.lat,
        lon: event.lngLat.lng,
        iso3: typeof iso3 === "string" ? iso3 : null,
      });
    };
    map.on("click", onClick);
    return () => {
      map.off("click", onClick);
    };
  }, [engine, latest]);

  const cancelClose = () => window.clearTimeout(closeTimer.current);
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(
      () => setOpen((current) => (current?.pinned ? current : null)),
      HOVER_CLOSE_MS,
    );
  };
  const hasPopup = (id: string) => Boolean(spec.points.find((point) => point.id === id)?.popup);

  const openPoint = open ? spec.points.find((point) => point.id === open.id) : undefined;
  const dark = basemap === "satellite";

  return (
    <div
      className={cn(
        "absolute inset-0",
        dark ? "bg-[var(--color-space-deep)]" : "bg-[var(--color-paper)]",
      )}
    >
      {/* Sized by height, not inset: MapLibre makes its container position: relative. */}
      <div ref={containerRef} className="h-full w-full" />
      {engine
        ? spec.points.map((point) => (
            <PointMarker
              key={point.id}
              engine={engine}
              point={point}
              dark={dark}
              draggable={editable}
              selected={editing?.selectedId === point.id}
              popupId={point.popup ? `${popupBase}-${point.id}` : null}
              expanded={open?.id === point.id}
              onActivate={(id) => {
                editing?.onSelect(id);
                cancelClose();
                setOpen((current) =>
                  current?.id === id && current.pinned
                    ? null
                    : hasPopup(id)
                      ? { id, pinned: true }
                      : null,
                );
              }}
              onHover={(id) => {
                cancelClose();
                if (!hasPopup(id)) return;
                setOpen((current) => (current?.pinned ? current : { id, pinned: false }));
              }}
              onLeave={scheduleClose}
              onClose={() => setOpen(null)}
              onMove={(id, position) => editing?.onMovePoint(id, position)}
            />
          ))
        : null}
      {engine && openPoint?.popup ? (
        <PointPopup
          key={`${openPoint.id}:${openPoint.lat}:${openPoint.lon}`}
          engine={engine}
          point={openPoint}
          popup={openPoint.popup}
          id={`${popupBase}-${openPoint.id}`}
          onEnter={cancelClose}
          onLeave={scheduleClose}
          onClose={() => setOpen(null)}
        />
      ) : null}
      {engine ? (
        <>
          <LegendOverlay legend={spec.legend} startFolded={narrow} />
          <ZoomOverlay
            corner={zoomCorner(spec)}
            onZoomIn={() => engine.map.zoomIn()}
            onZoomOut={() => engine.map.zoomOut()}
            onReset={() => {
              movedByReader.current = false;
              engine.map.fitBounds(toLngLatBounds(bounds), { padding: 0 });
            }}
          />
        </>
      ) : (
        <p
          role="status"
          className={cn(
            "absolute inset-0 grid place-items-center text-[13px]",
            dark ? "text-white/70" : "text-[var(--color-ink-muted)]",
          )}
        >
          {t.loading}
        </p>
      )}
    </div>
  );
}
