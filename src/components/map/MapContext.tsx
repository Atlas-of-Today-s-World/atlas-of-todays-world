"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export interface MapFocusState {
  /** [lon, lat] to rotate the globe to. null = leave it where it is. */
  center: [number, number] | null;
  zoom: number | null;
  /** Bounds [minLon, minLat, maxLon, maxLat]; take precedence over center/zoom. */
  bbox: [number, number, number, number] | null;
  /** Country to highlight with a white outline. */
  activeIso3: string | null;
  /** Countries of the active region – they get a stronger outline in the region's color. */
  regionCountries: string[];
  regionStroke: string | null;
}

const EMPTY_FOCUS: MapFocusState = {
  center: null,
  zoom: null,
  bbox: null,
  activeIso3: null,
  regionCountries: [],
  regionStroke: null,
};

/**
 * What a click on the globe selects: individual countries, Atlas regions,
 * or global issues composed by the editors.
 */
export type SelectionMode = "countries" | "regions" | "issue";

interface MapContextValue {
  focus: MapFocusState;
  setFocus: (focus: MapFocusState) => void;
  /** layer id: "encyclopedia" or an indicator id (hdi, gdp-per-capita, ...) */
  view: string;
  setView: (view: string) => void;
  mode: SelectionMode;
  setMode: (mode: SelectionMode) => void;
  /** The content panel is collapsed – the map covers the whole area. */
  panelCollapsed: boolean;
  setPanelCollapsed: (collapsed: boolean) => void;
}

const MapContext = createContext<MapContextValue | null>(null);

export function MapProvider({
  children,
  initialView = "encyclopedia",
}: {
  children: ReactNode;
  initialView?: string;
}) {
  const [focus, setFocusState] = useState<MapFocusState>(EMPTY_FOCUS);
  const [view, setView] = useState(initialView);
  const [mode, setMode] = useState<SelectionMode>("countries");
  const [panelCollapsed, setPanelCollapsed] = useState(false);

  // Pages report focus in an effect; without the comparison the globe would re-fly
  // on every layout render.
  const setFocus = useCallback((next: MapFocusState) => {
    setFocusState((current) =>
      current.activeIso3 === next.activeIso3 &&
      current.regionStroke === next.regionStroke &&
      current.center?.[0] === next.center?.[0] &&
      current.center?.[1] === next.center?.[1] &&
      current.zoom === next.zoom &&
      current.bbox?.join() === next.bbox?.join() &&
      current.regionCountries.length === next.regionCountries.length
        ? current
        : next,
    );
  }, []);

  const value = useMemo(
    () => ({
      focus,
      setFocus,
      view,
      setView,
      mode,
      setMode,
      panelCollapsed,
      setPanelCollapsed,
    }),
    [focus, setFocus, view, mode, panelCollapsed],
  );

  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
}

export function useMapState(): MapContextValue {
  const context = useContext(MapContext);
  if (!context) throw new Error("useMapState musí být uvnitř <MapProvider>");
  return context;
}
