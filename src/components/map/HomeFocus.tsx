"use client";

import { useMemo, useState } from "react";
import { useHydrated } from "@/lib/use-hydrated";
import { useMapState } from "./MapContext";
import MapFocus from "./MapFocus";
import { EUROPE_CENTER, detectHomeCamera, globeFillZoom } from "@/lib/home-location";

/**
 * Default view on the home page: the whole globe fills the window, country names are
 * legible and the sphere is rotated over the visitor's country. Detection runs only in the browser,
 * so the server HTML always has the same (European) viewport and hydration
 * doesn't diverge.
 *
 * Coming back from a country or region (closing its panel) the globe doesn't turn
 * away to the visitor's country: it only zooms out over the place just viewed.
 */
export default function HomeFocus({
  centers,
}: {
  /** ISO 3166-1 alpha-2 -> [lon, lat] */
  centers: Record<string, [number, number]>;
}) {
  const hydrated = useHydrated();
  const { focus } = useMapState();
  // Read once on arrival: a page focused the map before → we came from it.
  const [cameBack] = useState(() => focus.center !== null || focus.bbox !== null);
  const camera = useMemo(
    () =>
      cameBack
        ? { center: null, zoom: globeFillZoom() }
        : hydrated
          ? { center: detectHomeCamera(centers).center, zoom: globeFillZoom() }
          : { center: EUROPE_CENTER, zoom: 2.6 },
    [cameBack, hydrated, centers],
  );

  return <MapFocus center={camera.center} zoom={camera.zoom} />;
}
