import type { Region } from "@/features/geography/types";
import MapFocus from "./MapFocus";

/**
 * Turns the globe to a region (or a group: global issue, custom region) and
 * outlines its countries — or, without one, leaves the globe on no place.
 * A page can still set its own view: an explicit `center`, `zoom` or `bbox`
 * (also `null`) wins over the region's.
 */
export default function RegionFocus({
  region,
  activeIso3 = null,
  center,
  zoom,
  bbox = null,
}: {
  /** A region or a group (global issue, custom region); none = no outline. */
  region: Pick<Region, "center" | "zoom" | "countries" | "stroke"> | null | undefined;
  /** The country highlighted inside the region. */
  activeIso3?: string | null;
  center?: [number, number] | null;
  zoom?: number | null;
  bbox?: [number, number, number, number] | null;
}) {
  return (
    <MapFocus
      bbox={bbox}
      center={center !== undefined ? center : (region?.center ?? null)}
      zoom={zoom !== undefined ? zoom : (region?.zoom ?? null)}
      activeIso3={activeIso3}
      regionCountries={region?.countries ?? []}
      regionStroke={region?.stroke ?? null}
    />
  );
}
