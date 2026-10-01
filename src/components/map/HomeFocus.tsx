"use client";

import { useMemo } from "react";
import { useHydrated } from "@/lib/use-hydrated";
import MapFocus from "./MapFocus";
import { EUROPE_CENTER, detectHomeCamera, globeFillZoom } from "@/lib/home-location";

/**
 * Default view on the home page: the whole globe fills the window, country names are
 * legible and the sphere is rotated over the visitor's country. Detection runs only in the browser,
 * so the server HTML always has the same (European) viewport and hydration
 * doesn't diverge.
 */
export default function HomeFocus({
  centers,
}: {
  /** ISO 3166-1 alpha-2 -> [lon, lat] */
  centers: Record<string, [number, number]>;
}) {
  const hydrated = useHydrated();
  const camera = useMemo(
    () =>
      hydrated
        ? { center: detectHomeCamera(centers).center, zoom: globeFillZoom() }
        : { center: EUROPE_CENTER, zoom: 2.6 },
    [hydrated, centers],
  );

  return <MapFocus center={camera.center} zoom={camera.zoom} />;
}
