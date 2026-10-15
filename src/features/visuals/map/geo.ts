import { MAP_LIMITS, type MapBounds } from "./types";

/**
 * Pure geometry of map visuals: bounding boxes of countries, the view the
 * builder reads off the map, and the form MapLibre's fitBounds takes. Every
 * box is [west, south, east, north]; one that crosses the antimeridian keeps
 * west in [-180, 180) and writes east past 180.
 */

const round = (value: number, digits = 4) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const clampLatitude = (lat: number) =>
  Math.max(-MAP_LIMITS.maxLatitude, Math.min(MAP_LIMITS.maxLatitude, lat));

/** Longitude into [-180, 180). */
const wrapLongitude = (lon: number) => ((((lon + 180) % 360) + 360) % 360) - 180;

/**
 * The smallest box covering all `boxes`, going the short way round the globe:
 * Russia plus Alaska spans the Bering Strait, not the Atlantic. Null for none.
 */
export function unionBounds(boxes: readonly MapBounds[]): MapBounds | null {
  if (!boxes.length) return null;
  const south = Math.min(...boxes.map((box) => box[1]));
  const north = Math.max(...boxes.map((box) => box[3]));
  const arcs = boxes
    .map(([west, , east]) => ({ start: wrapLongitude(west), length: Math.min(east - west, 360) }))
    .sort((a, b) => a.start - b.start);
  if (arcs.some((arc) => arc.length >= 360)) return [-180, south, 180, north];

  // Merge overlapping arcs along the line, then find the widest stretch of
  // longitude nothing covers (wrapping from the last arc to the first).
  const merged: { start: number; end: number }[] = [];
  for (const { start, length } of arcs) {
    const last = merged.at(-1);
    if (last && start <= last.end) last.end = Math.max(last.end, start + length);
    else merged.push({ start, end: start + length });
  }
  const first = merged[0]!;
  const last = merged.at(-1)!;
  let gap = { size: first.start + 360 - last.end, west: first.start, east: last.end };
  for (let i = 1; i < merged.length; i++) {
    const size = merged[i]!.start - merged[i - 1]!.end;
    if (size > gap.size) gap = { size, west: merged[i]!.start, east: merged[i - 1]!.end + 360 };
  }
  if (gap.size <= 0) return [-180, south, 180, north];
  const west = wrapLongitude(gap.west);
  const east = west + (gap.east - gap.west);
  return [round(west), round(south), round(east), round(north)];
}

/** `bounds` grown by `ratio` of its size on every side, within what a map can show. */
export function padBounds([west, south, east, north]: MapBounds, ratio: number): MapBounds {
  // A tiny country (Malta) still gets a view a few degrees wide.
  const dx = Math.max((east - west) * ratio, 0.5);
  const dy = Math.max((north - south) * ratio, 0.5);
  const width = Math.min(east - west + 2 * dx, 360);
  const center = (west + east) / 2;
  const padWest = width >= 360 ? -180 : wrapLongitude(center - width / 2);
  return [
    round(padWest),
    round(clampLatitude(south - dy)),
    round(padWest + width),
    round(clampLatitude(north + dy)),
  ];
}

/** Share of a framed area's size added round it, so borders don't touch the edge. */
const COUNTRY_MARGIN = 0.08;

/** A view framing these countries (unknown codes are skipped); null for none. */
export function boundsOfCountries(
  iso3s: readonly string[],
  boxes: Readonly<Record<string, MapBounds>>,
): MapBounds | null {
  const known = iso3s.flatMap((iso3) => (Object.hasOwn(boxes, iso3) ? [boxes[iso3]!] : []));
  const union = unionBounds(known);
  return union ? padBounds(union, COUNTRY_MARGIN) : null;
}

/**
 * The view the map shows now ("Use this view"): MapLibre's bounds may run
 * past ±180 on a world-wrapping map; they come back in the spec's form.
 */
export function boundsFromView(
  west: number,
  south: number,
  east: number,
  north: number,
): MapBounds {
  const width = Math.min(east - west, 360);
  const start = width >= 360 ? -180 : wrapLongitude(west);
  return [
    round(start),
    round(clampLatitude(south)),
    round(start + width),
    round(clampLatitude(north)),
  ];
}

/** MapLibre's LngLatBoundsLike for a spec box. */
export const toLngLatBounds = ([west, south, east, north]: MapBounds): [
  [number, number],
  [number, number],
] => [
  [west, south],
  [east, north],
];

/** A coordinate as the spec stores it (≈1 m precision). */
const roundCoordinate = (value: number) => round(value, 5);

/** A point's position on the map, kept in range (a dragged marker may leave it). */
export function pointPosition(lng: number, lat: number): { lat: number; lon: number } {
  return { lat: roundCoordinate(clampLatitude(lat)), lon: roundCoordinate(wrapLongitude(lng)) };
}
