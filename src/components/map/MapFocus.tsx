"use client";

import { useEffect } from "react";
import { useMapState } from "./MapContext";

interface Props {
  center?: [number, number] | null;
  zoom?: number | null;
  /** Country/region bounds; take precedence over center + zoom. */
  bbox?: [number, number, number, number] | null;
  activeIso3?: string | null;
  regionCountries?: string[];
  regionStroke?: string | null;
}

/**
 * The server page just renders <MapFocus …/> and the globe in the layout rotates
 * to the right place by itself. Thanks to that the map stays mounted across routes.
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

  // No cleanup on unmount: when moving between routes the new page always sets
  // the focus, so a reset would only cause the highlight to flicker.
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
