"use client";

import { useEffect } from "react";
import { useMapState, type SelectionMode } from "./MapContext";

/**
 * Přepne globus do daného režimu výběru. Používá to routa global issue,
 * aby po otevření odkazu zvenčí seděl i přepínač nad mapou.
 */
export default function MapModeSetter({ mode }: { mode: SelectionMode }) {
  const { setMode } = useMapState();
  useEffect(() => {
    setMode(mode);
  }, [setMode, mode]);
  return null;
}
