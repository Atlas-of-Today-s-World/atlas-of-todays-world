import type { MapFocusState } from "./MapContext";

/**
 * Whether two focus states point the globe at the same place with the same
 * highlight. Compared by value: pages report focus in an effect with fresh
 * arrays, and an unchanged focus must not re-fly the globe.
 */
export function sameFocus(a: MapFocusState, b: MapFocusState): boolean {
  return (
    a.activeIso3 === b.activeIso3 &&
    a.regionStroke === b.regionStroke &&
    a.center?.[0] === b.center?.[0] &&
    a.center?.[1] === b.center?.[1] &&
    a.zoom === b.zoom &&
    a.bbox?.join() === b.bbox?.join() &&
    a.regionCountries.length === b.regionCountries.length &&
    a.regionCountries.every((iso3, i) => iso3 === b.regionCountries[i])
  );
}
