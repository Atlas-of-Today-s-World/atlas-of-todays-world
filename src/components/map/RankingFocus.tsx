"use client";

import { useEffect, useSyncExternalStore } from "react";
import MapFocus from "./MapFocus";

const subscribe = (onChange: () => void) => {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
};
const readHash = () => window.location.hash.slice(1).toLowerCase();
const noHash = () => "";

/**
 * A data layer's ranking with one country picked (`/view/hdi#hun`, from
 * "Ranked 46 of 193" on the country card): the globe flies to that country and
 * outlines it; without a pick it shows the whole world.
 */
export function RankingFocus({
  places,
}: {
  /** iso3 in lower case → bounds of the country. */
  places: Record<string, [number, number, number, number] | null>;
}) {
  const hash = useSyncExternalStore(subscribe, readHash, noHash);
  const bbox = places[hash];

  // The picked row sits in the middle of the panel (the panel scrolls on its own).
  useEffect(() => {
    if (!hash || !(hash in places)) return;
    document.getElementById(hash)?.scrollIntoView({ block: "center" });
  }, [hash, places]);

  if (hash && bbox !== undefined) {
    return <MapFocus bbox={bbox} activeIso3={hash.toUpperCase()} />;
  }
  return <MapFocus center={[18, 28]} zoom={1.7} />;
}
