"use client";

import { useEffect } from "react";
import { useMapState } from "./MapContext";

/** Switches the globe to a specific data layer (route /view/<indicator>). */
export default function MapViewSetter({ view }: { view: string }) {
  const { setView } = useMapState();
  useEffect(() => {
    setView(view);
  }, [setView, view]);
  return null;
}
