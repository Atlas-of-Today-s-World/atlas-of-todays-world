"use client";

import { useEffect, useState } from "react";
import MapFocus from "./MapFocus";
import { EUROPE_CENTER, detectHomeCamera, globeFillZoom } from "@/lib/home-location";

/**
 * Výchozí pohled na úvodní stránce: celý globus vyplní okno, názvy států jsou
 * čitelné a koule je otočená nad zemí návštěvníka. Detekce běží až v prohlížeči,
 * takže serverové HTML má vždycky stejný (evropský) výřez a hydratace se
 * nerozejde.
 */
export default function HomeFocus({
  centers,
}: {
  /** ISO 3166-1 alpha-2 -> [lon, lat] */
  centers: Record<string, [number, number]>;
}) {
  const [camera, setCamera] = useState<{
    center: [number, number];
    zoom: number;
  }>({ center: EUROPE_CENTER, zoom: 2.6 });

  useEffect(() => {
    setCamera({
      center: detectHomeCamera(centers).center,
      zoom: globeFillZoom(),
    });
  }, [centers]);

  return <MapFocus center={camera.center} zoom={camera.zoom} />;
}
