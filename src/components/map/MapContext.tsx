"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export interface MapFocusState {
  /** [lon, lat] kam otočit globus. null = nechat, kde je. */
  center: [number, number] | null;
  zoom: number | null;
  /** Výřez [minLon, minLat, maxLon, maxLat]; má přednost před center/zoom. */
  bbox: [number, number, number, number] | null;
  /** Země, kterou zvýraznit bílým obrysem. */
  activeIso3: string | null;
  /** Země aktivního regionu – dostanou silnější obrys v barvě regionu. */
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
 * Co se na globusu vybírá kliknutím: jednotlivé státy, regiony Atlasu,
 * nebo global issues složené redakcí.
 */
export type SelectionMode = "countries" | "regions" | "issue";

interface MapContextValue {
  focus: MapFocusState;
  setFocus: (focus: MapFocusState) => void;
  /** id vrstvy: "encyclopedia" nebo id indikátoru (hdi, gdp-per-capita, ...) */
  view: string;
  setView: (view: string) => void;
  mode: SelectionMode;
  setMode: (mode: SelectionMode) => void;
  /** Panel s obsahem je sbalený – mapa je přes celou plochu. */
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

  // Stránky hlásí focus v effectu; bez porovnání by se globus přeletoval
  // při každém renderu layoutu.
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
