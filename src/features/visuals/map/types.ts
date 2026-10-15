/**
 * A custom map visual (`visuals.map_spec`): what the builder edits, the
 * server validates (schema.ts, Zod) and the renderer draws. Plain types and
 * constants only — no Zod — so client components import them freely.
 */
import type { MapIconName } from "./icon-names";

export type { MapIconName } from "./icon-names";

/** Hard limits, the same in the schema and the builder. */
export const MAP_LIMITS = {
  points: 500,
  countries: 50,
  legendItems: 20,
  /** Whole spec as JSON, in bytes (UTF-8). */
  bytes: 200_000,
  label: 120,
  legendTitle: 120,
  legendLabel: 80,
  /** Popup HTML before sanitizing. */
  popupHtml: 5_000,
  pointSize: { min: 6, max: 48 },
  popupWidth: { min: 160, max: 420 },
  /** Web Mercator stops here; a point or a view further north/south can't be drawn. */
  maxLatitude: 85,
} as const;

export const MAP_PROJECTIONS = ["mercator", "globe"] as const;
type MapProjection = (typeof MAP_PROJECTIONS)[number];

/** Plain light map (default) or the globe's satellite imagery. */
export const MAP_BASEMAPS = ["light", "satellite"] as const;
type MapBasemap = (typeof MAP_BASEMAPS)[number];

/** How the view was chosen; `bounds` is what the renderer fits in every case. */
export const MAP_VIEW_MODES = ["countries", "region", "bounds"] as const;
export type MapViewMode = (typeof MAP_VIEW_MODES)[number];

/**
 * [west, south, east, north] in degrees. `east` may exceed 180 when the view
 * crosses the antimeridian (Russia to Alaska: [27, 41, 191, 78]).
 */
export type MapBounds = [west: number, south: number, east: number, north: number];

export interface MapView {
  mode: MapViewMode;
  /** ISO3 codes framed by a `countries` view. */
  countries: string[];
  /** The Atlas region or custom region framed by a `region` view (its name as it was then). */
  region: { slug: string; name: string } | null;
  bounds: MapBounds;
  projection: MapProjection;
  basemap: MapBasemap;
  /** Country names on the map. */
  labels: boolean;
}

/** A country painted in its own colour. */
export interface MapCountryHighlight {
  iso3: string;
  /** #rrggbb */
  fill: string;
  /** 0–1 */
  opacity: number;
  /** Outline colour (#rrggbb), or none. */
  outline: string | null;
}

export const POPUP_FONTS = ["sans", "display", "serif"] as const;
export type PopupFont = (typeof POPUP_FONTS)[number];

export const POPUP_SIZES = ["sm", "md", "lg"] as const;
export type PopupSize = (typeof POPUP_SIZES)[number];

export interface MapPopup {
  /** Sanitized rich text (lib/security/sanitize.ts `sanitizePopupHtml`). */
  html: string;
  font: PopupFont;
  size: PopupSize;
  /** Text colour, #rrggbb. */
  color: string;
  /** Background, #rrggbb. */
  background: string;
  /** Widest the popup grows, in px (narrower on a small screen). */
  maxWidth: number;
}

export interface MapPoint {
  /** Short id, unique within the spec ([a-z0-9], ≤ 16). */
  id: string;
  lat: number;
  lon: number;
  /** Accessible name of the point, the popup's heading and the optional map label. */
  label: string;
  /** Show the label next to the point on the map. */
  showLabel: boolean;
  /** #rrggbb */
  color: string;
  /** Diameter in px. */
  size: number;
  /** A curated icon, or null for a plain circle. */
  icon: MapIconName | null;
  /** A ring pulsing around the point (never with reduced motion). */
  pulse: boolean;
  popup: MapPopup | null;
}

export const MAP_CORNERS = ["top-left", "top-right", "bottom-left", "bottom-right"] as const;
export type MapCorner = (typeof MAP_CORNERS)[number];

export interface MapLegendItem {
  label: string;
  /** #rrggbb, or none (icon only). */
  color: string | null;
  icon: MapIconName | null;
}

export interface MapLegend {
  /** Shown at all. */
  visible: boolean;
  title: string;
  position: MapCorner;
  items: MapLegendItem[];
}

export interface MapSpec {
  version: 1;
  view: MapView;
  countries: MapCountryHighlight[];
  points: MapPoint[];
  legend: MapLegend;
}

/** The whole world on a flat map (a new visual starts here). */
const WORLD_BOUNDS: MapBounds = [-170, -58, 190, 78];

export const DEFAULT_POPUP: MapPopup = {
  html: "",
  font: "sans",
  size: "md",
  color: "#16192b",
  background: "#ffffff",
  maxWidth: 280,
};

export function emptyMapSpec(): MapSpec {
  return {
    version: 1,
    view: {
      mode: "bounds",
      countries: [],
      region: null,
      bounds: [...WORLD_BOUNDS],
      projection: "mercator",
      basemap: "light",
      labels: true,
    },
    countries: [],
    points: [],
    legend: { visible: false, title: "", position: "bottom-left", items: [] },
  };
}
