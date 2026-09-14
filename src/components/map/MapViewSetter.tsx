"use client";

import { useEffect } from "react";
import { useMapState } from "./MapContext";

/** Přepne globus na konkrétní datovou vrstvu (routa /view/<indikátor>). */
export default function MapViewSetter({ view }: { view: string }) {
  const { setView } = useMapState();
  useEffect(() => {
    setView(view);
  }, [setView, view]);
  return null;
}
