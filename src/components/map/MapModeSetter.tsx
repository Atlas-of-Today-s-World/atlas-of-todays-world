"use client";

import { useEffect } from "react";
import { useMapState, type SelectionMode } from "./MapContext";

/**
 * Switches the globe to the given selection mode. Used by the global issue route
 * so that the switcher above the map matches when a link is opened from outside.
 */
export default function MapModeSetter({ mode }: { mode: SelectionMode }) {
  const { setMode } = useMapState();
  useEffect(() => {
    setMode(mode);
  }, [setMode, mode]);
  return null;
}
