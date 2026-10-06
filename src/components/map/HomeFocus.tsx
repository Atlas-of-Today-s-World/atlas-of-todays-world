"use client";

import { useEffect, useState } from "react";
import { useMapState } from "./MapContext";
import MapFocus from "./MapFocus";
import { detectHomeCamera, fetchIpCountry, globeFillZoom } from "@/lib/home-location";

/**
 * Default view on the home page: the whole globe fills the window, country names are
 * legible and the sphere is rotated over the visitor's country — by the country of
 * their IP address, else time zone and language (lib/home-location.ts). Detection
 * runs only in the browser; until it answers the globe stays on its first frame
 * (Europe), so it flies only once.
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
  // undefined = still asking; null = unknown.
  const [ipCountry, setIpCountry] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (cameBack) return;
    let active = true;
    void fetchIpCountry().then((country) => {
      if (active) setIpCountry(country);
    });
    return () => {
      active = false;
    };
  }, [cameBack]);

  if (cameBack) return <MapFocus center={null} zoom={globeFillZoom()} />;
  if (ipCountry === undefined) return null;
  return <MapFocus center={detectHomeCamera(centers, ipCountry).center} zoom={globeFillZoom()} />;
}
