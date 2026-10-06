"use client";

import { useEffect, useRef, useState } from "react";
import { useMapState } from "./MapContext";
import MapFocus from "./MapFocus";
import { fetchIpCountry, globeFillZoom } from "@/lib/home-location";

/**
 * Default view on the home page: the whole globe fills the window, country names are
 * legible and the sphere is rotated over the visitor's country — by the country of
 * their IP address, else time zone and language (lib/home-location-guess.ts, loaded
 * only for that fallback). Detection runs only in the browser; until it answers
 * the globe stays on its first frame (Europe), so it flies only once.
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
  const { focus } = useMapState();
  // Read once on arrival: a page focused the map before → we came from it.
  const [cameBack] = useState(() => focus.center !== null || focus.bbox !== null);
  // Read once: a refreshed server payload must not send the globe flying again.
  const centersOnArrival = useRef(centers);
  // undefined = still detecting.
  const [center, setCenter] = useState<[number, number] | undefined>(undefined);

  useEffect(() => {
    if (cameBack) return;
    let active = true;
    void (async () => {
      const known = centersOnArrival.current;
      const ipCountry = await fetchIpCountry();
      const next =
        (ipCountry ? known[ipCountry] : undefined) ??
        (await import("@/lib/home-location-guess")).detectHomeCamera(known).center;
      if (active) setCenter(next);
    })();
    return () => {
      active = false;
    };
  }, [cameBack]);

  if (cameBack) return <MapFocus center={null} zoom={globeFillZoom()} />;
  if (center === undefined) return null;
  return <MapFocus center={center} zoom={globeFillZoom()} />;
}
