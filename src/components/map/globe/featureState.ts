import type { Map as MapLibreMap } from "maplibre-gl";

type StateKey = "hover" | "inRegion" | "active";

/**
 * Toggles feature-state for the given countries and turns off the previous ones.
 * The ref holds what's currently lit, so only the difference is touched.
 */
export function applyFeatureState(
  map: MapLibreMap,
  ref: { current: string[] },
  next: string[],
  key: StateKey,
) {
  const nextSet = new Set(next);
  for (const iso3 of ref.current) {
    if (!nextSet.has(iso3)) {
      map.setFeatureState({ source: "countries", id: iso3 }, { [key]: false });
    }
  }
  const previous = new Set(ref.current);
  for (const iso3 of next) {
    if (!previous.has(iso3)) {
      map.setFeatureState({ source: "countries", id: iso3 }, { [key]: true });
    }
  }
  ref.current = next;
}

export const setHoverState = (map: MapLibreMap, ref: { current: string[] }, next: string[]) =>
  applyFeatureState(map, ref, next, "hover");
