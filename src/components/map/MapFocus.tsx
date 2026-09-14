"use client";

import { useEffect } from "react";
import { useMapState } from "./MapContext";

interface Props {
  center?: [number, number] | null;
  zoom?: number | null;
  /** Výřez země/regionu; má přednost před center + zoom. */
  bbox?: [number, number, number, number] | null;
  activeIso3?: string | null;
  regionCountries?: string[];
  regionStroke?: string | null;
}

/**
 * Serverová stránka jen vyrenderuje <MapFocus …/> a globus v layoutu se sám
 * otočí na správné místo. Díky tomu zůstává mapa namontovaná napříč routami.
 */
export default function MapFocus({
  center = null,
  zoom = null,
  bbox = null,
  activeIso3 = null,
  regionCountries = [],
  regionStroke = null,
}: Props) {
  const { setFocus } = useMapState();

  // Bez úklidu na unmount: při přechodu mezi routami si focus vždy nastaví
  // nová stránka, takže by reset jen způsobil bliknutí zvýraznění.
  useEffect(() => {
    setFocus({ center, zoom, bbox, activeIso3, regionCountries, regionStroke });
  }, [
    setFocus,
    center?.[0],
    center?.[1],
    zoom,
    bbox?.join(),
    activeIso3,
    regionStroke,
    regionCountries.join(","),
  ]);

  return null;
}
