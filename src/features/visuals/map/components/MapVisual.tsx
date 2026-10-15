"use client";

import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { format } from "@/lib/i18n/messages";
import { useMessages } from "@/components/i18n/LocaleProvider";
import { cn } from "@/lib/cn";
import type { MapSpec } from "../types";
import type { MapEditing } from "./MapCanvas";

/** MapLibre, the markers and the icons load with the map, not with the page. */
const MapCanvas = lazy(() => import("./MapCanvas"));

/** Start loading a little before the map scrolls into view. */
const PRELOAD_MARGIN = "300px";

/** The map box: wide on a desktop, taller on a phone, never taller than the screen. */
const MAP_FRAME_CLASS =
  "relative aspect-square max-h-[80vh] w-full overflow-hidden sm:aspect-[16/9]";

/**
 * A custom map visual (topic, region or global issue page). Only a light box
 * is in the page at first; MapLibre and the map's code load once the box
 * nears the viewport. Without WebGL a message and the list of places take
 * the map's place. Pass a spec that went through `parseMapSpec` on the server.
 */
export function MapVisual({ spec, title }: { spec: MapSpec; title?: string }) {
  return <MapFrame spec={spec} title={title} />;
}

/** The box and its states; the builder renders it with `editing` (same map, same look). */
export function MapFrame({
  spec,
  title,
  editing,
  className,
  children,
}: {
  spec: MapSpec;
  title?: string;
  editing?: MapEditing;
  className?: string;
  /** Extra overlays (the builder's hints). */
  children?: ReactNode;
}) {
  const t = useMessages().mapVisual;
  const boxRef = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    if (typeof IntersectionObserver !== "function") {
      // Old browsers: load right away rather than never.
      const start = window.setTimeout(() => setNear(true), 0);
      return () => window.clearTimeout(start);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setNear(true);
        observer.disconnect();
      },
      { rootMargin: PRELOAD_MARGIN },
    );
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  const dark = spec.view.basemap === "satellite";
  return (
    <div
      ref={boxRef}
      role="region"
      aria-label={title ? format(t.regionTitled, { title }) : t.region}
      className={cn(
        MAP_FRAME_CLASS,
        "rounded-2xl",
        dark ? "bg-[var(--color-space-deep)]" : "bg-[var(--color-paper)]",
        className,
      )}
    >
      {failed ? (
        <Unavailable spec={spec} />
      ) : near ? (
        <Suspense fallback={null}>
          <MapCanvas spec={spec} editing={editing} onFail={() => setFailed(true)} />
        </Suspense>
      ) : null}
      {children}
    </div>
  );
}

/** No WebGL (or MapLibre failed to load): say so, and still list the places. */
function Unavailable({ spec }: { spec: MapSpec }) {
  const t = useMessages().mapVisual;
  return (
    <div
      role="status"
      className="absolute inset-0 overflow-auto bg-[var(--color-paper)] p-4 text-[13.5px]"
    >
      <p className="font-medium text-[var(--color-ink)]">{t.unavailable}</p>
      {spec.points.length ? (
        <>
          <p className="mt-3 text-[12px] font-semibold tracking-wide text-[var(--color-ink-muted)] uppercase">
            {t.placesOnMap}
          </p>
          <ul className="mt-1 list-disc pl-5 text-[var(--color-ink-soft)]">
            {spec.points.map((point) => (
              <li key={point.id}>{point.label}</li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
