import {
  DEFAULT_POPUP,
  MAP_LIMITS,
  type MapCountryHighlight,
  type MapLegendItem,
  type MapPoint,
  type MapPopup,
  type MapSpec,
} from "./types";
import { storedBytes } from "./size";

/**
 * The builder's edits as pure functions over the spec (each returns a new
 * spec, the old one stays intact for undo). The limits of MAP_LIMITS hold
 * here too: an edit past them returns the spec unchanged.
 */

/** A short id no other point has. */
export function newPointId(taken: Iterable<string>, random: () => number = Math.random): string {
  const used = new Set(taken);
  for (;;) {
    const id = random().toString(36).slice(2, 10);
    if (/^[a-z0-9]{1,16}$/.test(id) && !used.has(id)) return id;
  }
}

const DEFAULT_POINT_COLOR = "#c0392b";
const DEFAULT_POINT_SIZE = 18;

/** A new point at `lat`/`lon`, styled like `template` (the selected point) when given. */
export function addPoint(
  spec: MapSpec,
  at: { lat: number; lon: number },
  template?: MapPoint | null,
  random?: () => number,
): { spec: MapSpec; id: string | null } {
  if (spec.points.length >= MAP_LIMITS.points) return { spec, id: null };
  const id = newPointId(
    spec.points.map((point) => point.id),
    random,
  );
  const point: MapPoint = {
    id,
    lat: at.lat,
    lon: at.lon,
    label: `Point ${spec.points.length + 1}`,
    showLabel: template?.showLabel ?? false,
    color: template?.color ?? DEFAULT_POINT_COLOR,
    size: template?.size ?? DEFAULT_POINT_SIZE,
    icon: template?.icon ?? null,
    pulse: template?.pulse ?? false,
    popup: template?.popup ? { ...template.popup, html: "" } : null,
  };
  return { spec: { ...spec, points: [...spec.points, point] }, id };
}

export function updatePoint(spec: MapSpec, id: string, patch: Partial<MapPoint>): MapSpec {
  return {
    ...spec,
    points: spec.points.map((point) => (point.id === id ? { ...point, ...patch, id } : point)),
  };
}

export function removePoint(spec: MapSpec, id: string): MapSpec {
  return { ...spec, points: spec.points.filter((point) => point.id !== id) };
}

/** A copy of the point right after it, nudged east so both stay visible. */
export function duplicatePoint(
  spec: MapSpec,
  id: string,
  random?: () => number,
): { spec: MapSpec; id: string | null } {
  const index = spec.points.findIndex((point) => point.id === id);
  const source = spec.points[index];
  if (!source || spec.points.length >= MAP_LIMITS.points) return { spec, id: null };
  const copyId = newPointId(
    spec.points.map((point) => point.id),
    random,
  );
  const copy: MapPoint = {
    ...source,
    id: copyId,
    lon: source.lon + 0.5 > 180 ? source.lon - 0.5 : source.lon + 0.5,
    label: `${source.label} (copy)`.slice(0, MAP_LIMITS.label),
  };
  const points = [...spec.points];
  points.splice(index + 1, 0, copy);
  return { spec: { ...spec, points }, id: copyId };
}

/** The popup look of `source` (all but the text) on every point that has a popup. */
export function applyPopupStyleToAll(spec: MapSpec, source: MapPopup): MapSpec {
  const { html: _html, ...style } = source;
  return {
    ...spec,
    points: spec.points.map((point) =>
      point.popup ? { ...point, popup: { ...point.popup, ...style } } : point,
    ),
  };
}

export const newPopup = (): MapPopup => ({ ...DEFAULT_POPUP });

export const DEFAULT_HIGHLIGHT_COLOR = "#e0a526";

/** Highlights for these countries (ones already highlighted keep their look). */
export function addHighlights(
  spec: MapSpec,
  iso3s: readonly string[],
  fill = DEFAULT_HIGHLIGHT_COLOR,
): MapSpec {
  const have = new Set(spec.countries.map((country) => country.iso3));
  const added: MapCountryHighlight[] = [];
  for (const iso3 of iso3s) {
    if (have.has(iso3) || spec.countries.length + added.length >= MAP_LIMITS.countries) continue;
    have.add(iso3);
    added.push({ iso3, fill, opacity: 0.7, outline: null });
  }
  return added.length ? { ...spec, countries: [...spec.countries, ...added] } : spec;
}

export function updateHighlight(
  spec: MapSpec,
  iso3: string,
  patch: Partial<MapCountryHighlight>,
): MapSpec {
  return {
    ...spec,
    countries: spec.countries.map((country) =>
      country.iso3 === iso3 ? { ...country, ...patch, iso3 } : country,
    ),
  };
}

/** Highlighted → removed, otherwise added (a click on a country in the builder). */
export function toggleHighlight(spec: MapSpec, iso3: string): MapSpec {
  return spec.countries.some((country) => country.iso3 === iso3)
    ? { ...spec, countries: spec.countries.filter((country) => country.iso3 !== iso3) }
    : addHighlights(spec, [iso3]);
}

export function updateLegendItem(
  spec: MapSpec,
  index: number,
  patch: Partial<MapLegendItem>,
): MapSpec {
  return {
    ...spec,
    legend: {
      ...spec.legend,
      items: spec.legend.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    },
  };
}

export function addLegendItem(spec: MapSpec, item: MapLegendItem): MapSpec {
  if (spec.legend.items.length >= MAP_LIMITS.legendItems) return spec;
  return { ...spec, legend: { ...spec.legend, items: [...spec.legend.items, item] } };
}

export function removeLegendItem(spec: MapSpec, index: number): MapSpec {
  return {
    ...spec,
    legend: { ...spec.legend, items: spec.legend.items.filter((_, i) => i !== index) },
  };
}

/** Moves a legend item one place up (-1) or down (+1). */
export function moveLegendItem(spec: MapSpec, index: number, by: -1 | 1): MapSpec {
  const target = index + by;
  const items = [...spec.legend.items];
  const [item] = items.splice(index, 1);
  if (!item || target < 0 || target > items.length) return spec;
  items.splice(target, 0, item);
  return { ...spec, legend: { ...spec.legend, items } };
}

/**
 * Legend items for the kinds of points on the map — one per distinct colour
 * and icon, labelled with the first such point's label (to be renamed).
 */
export function legendFromPoints(points: readonly MapPoint[]): MapLegendItem[] {
  const seen = new Map<string, MapLegendItem>();
  for (const point of points) {
    const key = `${point.color}|${point.icon ?? ""}`;
    if (!seen.has(key)) {
      seen.set(key, {
        label: point.label.slice(0, MAP_LIMITS.legendLabel),
        color: point.color,
        icon: point.icon,
      });
    }
  }
  return [...seen.values()].slice(0, MAP_LIMITS.legendItems);
}

/** Size of the spec as the database counts it (size.ts). */
export const specBytes = (spec: MapSpec) => storedBytes(spec) ?? 0;

/** Undo history: earlier specs, newest last; `key` groups edits of one field. */
export interface History {
  past: MapSpec[];
  key: string | null;
}

const HISTORY_DEPTH = 50;

export const emptyHistory = (): History => ({ past: [], key: null });

/**
 * History after an edit away from `previous`. Edits with the same `key` in a
 * row (typing into one field) are one step, so undo doesn't go letter by letter.
 */
export function recordEdit(history: History, previous: MapSpec, key?: string): History {
  if (key && key === history.key) return history;
  return { past: [...history.past, previous].slice(-HISTORY_DEPTH), key: key ?? null };
}

/** The spec to go back to, and the history without it; null when there's nothing to undo. */
export function undo(history: History): { spec: MapSpec; history: History } | null {
  const spec = history.past.at(-1);
  return spec ? { spec, history: { past: history.past.slice(0, -1), key: null } } : null;
}
