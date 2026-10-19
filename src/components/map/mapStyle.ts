import type { GeoJSONSourceSpecification, StyleSpecification } from "maplibre-gl";
import { GLOBE } from "@/config/layout";
import { GLOBE_COLORS, THEME_COLORS } from "@/config/palette";
import { EUROPE_CENTER } from "@/lib/home-location";
import { publicEnv } from "@/lib/env";
import { glyphsUrl } from "./glyphs";

/** Plocha z administrace (map_areas) — GeoJSON Polygon s barvami. */
interface AreaShape {
  slug: string;
  label: string;
  fill: string;
  stroke: string;
  geometry: { type: "Polygon"; coordinates: number[][][] };
}

export interface StyleOptions {
  /** Border width multiplier from the site appearance settings. */
  border: number;
  areas: AreaShape[];
  /** Anchor points of the global issues / country groups (their topic counts sit there). */
  issueLabels: RegionLabel[];
}

export interface RegionLabel {
  slug: string;
  name: string;
  center: [number, number];
}

/**
 * Label points (country names, groups, their topic pills) are a few hundred
 * points, so they stay in a single tile of the whole world, scaled up at every
 * zoom: turning the globe needs no new tiles, and a zoom step only one. With
 * the default tiling, every newly turned-in part of the globe waited for its
 * tiles behind the heavy border tiles in MapLibre's worker, and phones showed
 * no pills there for seconds. A world tile holds positions to 1/8192 of the
 * world: under 3 px off up to zoom 6, which a label point can afford.
 */
const LABEL_SOURCE_MAXZOOM = 0;

/** Group labels – one point per region or global issue, at its hand-picked center. */
function regionLabelSource(regions: RegionLabel[]): GeoJSONSourceSpecification {
  return {
    type: "geojson",
    maxzoom: LABEL_SOURCE_MAXZOOM,
    data: {
      type: "FeatureCollection",
      features: regions.map((region) => ({
        type: "Feature" as const,
        properties: { name: region.name, slug: region.slug },
        geometry: { type: "Point" as const, coordinates: region.center },
      })),
    },
  };
}

/** Where the globe's first requests go once it starts (preconnected early, maplibre.ts). */
export const GLOBE_DATA = {
  origins: [
    publicEnv.NEXT_PUBLIC_MAPTILER_KEY
      ? "https://api.maptiler.com"
      : "https://server.arcgisonline.com",
    // Label glyphs come with the site (glyphs.ts): no connection to warm up for them.
  ],
  countries: "/data/countries.geo.json",
} as const;

/**
 * Satellite basemap. With a MapTiler key we use their tiles, without a key
 * Esri World Imagery (free, requires attribution).
 */
export function satelliteSource() {
  const key = publicEnv.NEXT_PUBLIC_MAPTILER_KEY;
  if (key) {
    return {
      tiles: [
        `https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=${encodeURIComponent(key)}`,
      ],
      attribution:
        '<a href="https://www.maptiler.com/copyright/">MapTiler</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxzoom: 20,
    };
  }
  return {
    tiles: [
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    ],
    attribution: 'Imagery © <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics',
    maxzoom: 18,
  };
}

export const LAYERS = {
  /** Dashed outline of territories whose status the UN doesn't consider settled. */
  disputedOutline: "country-disputed",
  satellite: "satellite",
  fill: "country-fill",
  countryHover: "country-hover",
  border: "country-border",
  regionOutline: "region-outline",
  activeOutline: "active-outline",
  label: "country-label",
  regionLabel: "region-label",
} as const;

/**
 * Topic count badges per globe mode (filters and numbers are set at runtime);
 * the countries' are split into COUNTRY_BADGE_BANDS, named after this id.
 */
export const TOPIC_LAYERS = {
  countries: "topic-count-country",
  regions: "topic-count-region",
  issue: "topic-count-issue",
} as const;

/**
 * The pills behind a topic count (drawn in AtlasGlobe on `styleimagemissing`):
 * white for global issues; for regions and countries the region's progress —
 * green once completed, amber while planned. 0 included.
 */
export const TOPIC_BADGE_IMAGES = {
  some: "topic-badge",
  completed: "topic-badge-completed",
  planned: "topic-badge-planned",
} as const;

/** The largest LABELRANK (1 = large countries, 8 = tiny territories) named at a zoom. */
const RANK_LIMIT = { base: 0.5, perZoom: 1.45 } as const;
const rankLimit = (zoom: number) => RANK_LIMIT.base + RANK_LIMIT.perZoom * zoom;

/**
 * Same rule as country names: small countries appear only when zoomed in.
 * MapLibre evaluates `zoom` in a filter at the tile's whole zoom (1.96 counts as 1).
 */
export const COUNTRY_RANK_FILTER = [
  "<=",
  ["get", "rank"],
  ["+", RANK_LIMIT.base, ["*", RANK_LIMIT.perZoom, ["zoom"]]],
];

/**
 * The globe's names and pills follow a whole "label zoom" kept in this global
 * state (AtlasGlobe updates it as the camera moves, labelZoomAt).
 *
 * MapLibre's own zoom won't do on the globe: turning it toward a pole lowers
 * the zoom so the sphere keeps its size (60° north is a whole zoom less than
 * the equator, the pole about three), so past Europe toward the north — the
 * Nordics, Russia, on to East Asia — names and pills dropped out though the
 * view was as close as before. North of the latitude the rules were tuned at
 * the label zoom adds that back; south of it it is MapLibre's zoom, as tuned.
 */
export const LABEL_ZOOM_STATE = "labelZoom";
/** Latitude the label rules were tuned at: the home view over Europe. */
const LABEL_TUNED_LAT = EUROPE_CENTER[1];
/** MapLibre's latitude limit (its globe zoom adjustment stops there). */
const MAX_LAT = 85.051129;

/** The whole label zoom at a camera's zoom and centre latitude (LABEL_ZOOM_STATE). */
export function labelZoomAt(zoom: number, lat: number): number {
  const cos = (deg: number) => Math.cos((Math.min(Math.abs(deg), MAX_LAT) * Math.PI) / 180);
  const poleward = Math.max(0, Math.log2(cos(LABEL_TUNED_LAT) / cos(lat)));
  // Rounded first, so float noise at a whole zoom doesn't drop it a level.
  return Math.floor(Number((zoom + poleward).toFixed(6)));
}

const labelZoom = ["global-state", LABEL_ZOOM_STATE];

/** COUNTRY_RANK_FILTER by the label zoom, for the globe's names. */
const GLOBE_RANK_FILTER = [
  "<=",
  ["get", "rank"],
  ["+", RANK_LIMIT.base, ["*", RANK_LIMIT.perZoom, labelZoom]],
];

/** Opacity `full` from the label zoom `from` on, 0 below it. */
export const fromLabelZoom = (from: number, full: number) => ["step", labelZoom, 0, from, full];

/** Whole zooms the country pills are banded by, up to the globe's closest zoom. */
const BAND_ZOOMS = Array.from({ length: GLOBE.maxZoom }, (_, i) => i + 1);

/**
 * Country pills follow the names' rank rule without a filter: one layer per
 * whole zoom holds the countries named from that zoom on, and the label zoom
 * shows it (AtlasGlobe sets the opacity, fromLabelZoom). A filter is read when
 * the worker lays out a tile, so past every whole zoom the smaller countries'
 * pills waited for the tile again, seconds on a busy phone; every band is in
 * every tile, so a pill shows the moment its zoom is reached.
 */
export const COUNTRY_BADGE_BANDS = BAND_ZOOMS.map((zoom) => {
  const rank = ["get", "rank"];
  const upTo = ["<=", rank, rankLimit(zoom)];
  return {
    id: `${TOPIC_LAYERS.countries}-${zoom}`,
    zoom,
    filter: zoom === 1 ? upTo : ["all", [">", rank, rankLimit(zoom - 1)], upTo],
  };
});

/**
 * A topic count under a label: a small pill that never hides a place name
 * (placed regardless of collisions and ignored by them).
 */
function topicBadgeLayer(id: string, source: string, { below = 1.35 } = {}) {
  return {
    id,
    type: "symbol" as const,
    source,
    // Nothing until AtlasGlobe knows the counts.
    filter: ["boolean", false],
    layout: {
      "text-field": "",
      "text-font": ["Open Sans Semibold"],
      "text-size": 10,
      "text-anchor": "top" as const,
      // Ems below the label point: past a one-line country name, a two-line region name.
      "text-offset": [0, below],
      "icon-image": TOPIC_BADGE_IMAGES.some,
      "icon-text-fit": "both" as const,
      "icon-text-fit-padding": [1.5, 4.5, 1.5, 4.5],
      "text-allow-overlap": true,
      "icon-allow-overlap": true,
      "text-ignore-placement": true,
      "icon-ignore-placement": true,
    },
    paint: {
      "text-color": GLOBE_COLORS.badgeText,
      "icon-opacity": 0.92,
    },
  };
}

/**
 * Globe style. Country coloring isn't handled here – it's overridden at runtime via
 * `setPaintProperty`, so switching layers (Encyclopedia / HDI / ...) doesn't have to
 * reload the whole style and lose the camera position.
 */
export function buildStyle(regions: RegionLabel[], options: StyleOptions): StyleSpecification {
  const satellite = satelliteSource();
  const b = options.border;
  const areas: GeoJSONSourceSpecification = {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: options.areas.map((area) => ({
        type: "Feature" as const,
        properties: { slug: area.slug, label: area.label, fill: area.fill, stroke: area.stroke },
        geometry: area.geometry,
      })),
    },
  };

  return {
    version: 8,
    projection: { type: "globe" },
    state: { [LABEL_ZOOM_STATE]: { default: labelZoomAt(2, LABEL_TUNED_LAT) } },
    glyphs: glyphsUrl(),
    sources: {
      satellite: { type: "raster", tileSize: 256, ...satellite },
      countries: {
        type: "geojson",
        data: GLOBE_DATA.countries,
        promoteId: "iso3",
      },
      // One point per country: otherwise a MultiPolygon would place a label on every island.
      "country-labels": {
        type: "geojson",
        data: "/data/country-labels.geo.json",
        maxzoom: LABEL_SOURCE_MAXZOOM,
      },
      "region-labels": regionLabelSource(regions),
      "issue-labels": regionLabelSource(options.issueLabels),
      areas,
    },
    sky: {
      "sky-color": "#0b1a3a",
      "sky-horizon-blend": 0.5,
      "horizon-color": "#4a6fa5",
      "horizon-fog-blend": 0.6,
      "fog-color": THEME_COLORS.space,
      "fog-ground-blend": 0.05,
      "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 4, 0.6, 6, 0],
    },
    // Even lighting: a day/night terminator would drown half the globe in darkness.
    light: { anchor: "viewport", position: [1.15, 210, 30], intensity: 0.05 },
    layers: [
      { id: "space", type: "background", paint: { "background-color": THEME_COLORS.spaceDeep } },
      {
        id: LAYERS.satellite,
        type: "raster",
        source: "satellite",
        paint: {
          "raster-opacity": 1,
          "raster-saturation": 0,
          "raster-contrast": 0,
          "raster-fade-duration": 200,
        },
      },
      {
        id: LAYERS.fill,
        type: "fill",
        source: "countries",
        paint: { "fill-color": GLOBE_COLORS.land, "fill-opacity": 0.61 },
      },
      {
        // Hover highlight. The layer is always rendered, just transparent –
        // only feature-state changes, so the map doesn't re-tessellate geometry.
        // (setFilter would redraw the whole layer on every mouse move and flicker.)
        id: LAYERS.countryHover,
        type: "fill",
        source: "countries",
        paint: {
          "fill-color": "#ffffff",
          "fill-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.2, 0],
          "fill-opacity-transition": { duration: 120, delay: 0 },
        },
      },
      {
        id: LAYERS.border,
        type: "line",
        source: "countries",
        paint: {
          "line-color": "rgba(255,255,255,0.45)",
          "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.3 * b, 5, 1.1 * b],
        },
      },
      {
        // Disputed and non-self-governing territories (Kosovo, Western Sahara, Palestine,
        // Taiwan) have a dashed outline – Atlas follows UN practice and this
        // is a visual note that the border isn't a settled matter.
        // Source of truth: src/data/territories.json
        id: LAYERS.disputedOutline,
        type: "line",
        source: "countries",
        filter: ["has", "status"],
        paint: {
          "line-color": "rgba(255,255,255,0.85)",
          "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.8 * b, 5, 2 * b],
          "line-dasharray": [2.5, 1.8],
        },
      },
      // Custom editorial areas (admin → Map areas).
      {
        id: "areas-fill",
        type: "fill",
        source: "areas",
        paint: { "fill-color": ["get", "fill"], "fill-opacity": 0.35 },
      },
      {
        id: "areas-outline",
        type: "line",
        source: "areas",
        paint: {
          "line-color": ["get", "stroke"],
          "line-width": ["interpolate", ["linear"], ["zoom"], 1, 1 * b, 5, 2.2 * b],
          "line-dasharray": [3, 1.5],
        },
      },
      {
        id: "areas-label",
        type: "symbol",
        source: "areas",
        minzoom: 2.5,
        layout: {
          "text-field": ["get", "label"],
          "text-font": ["Open Sans Regular"],
          "text-size": 12,
        },
        paint: {
          "text-color": "rgba(255,255,255,0.95)",
          "text-halo-color": "rgba(6,10,20,0.85)",
          "text-halo-width": 1.3,
        },
      },
      {
        id: LAYERS.regionOutline,
        type: "line",
        source: "countries",
        paint: {
          "line-color": "#b03a2e",
          "line-width": ["interpolate", ["linear"], ["zoom"], 1, 1, 5, 2.4],
          "line-opacity": ["case", ["boolean", ["feature-state", "inRegion"], false], 1, 0],
          "line-opacity-transition": { duration: 180, delay: 0 },
        },
      },
      {
        id: LAYERS.activeOutline,
        type: "line",
        source: "countries",
        paint: {
          "line-color": "#ffffff",
          "line-width": ["interpolate", ["linear"], ["zoom"], 1, 1.4, 5, 3],
          "line-blur": 0.3,
          "line-opacity": ["case", ["boolean", ["feature-state", "active"], false], 1, 0],
          "line-opacity-transition": { duration: 180, delay: 0 },
        },
      },
      {
        id: LAYERS.label,
        type: "symbol",
        source: "country-labels",
        // LABELRANK: 1 = large countries, 8 = tiny territories. Smaller ones appear only when zoomed in.
        filter: GLOBE_RANK_FILTER,
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Open Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 1.6, 9.5, 3, 11.5, 6, 15],
          "text-max-width": 8,
          "text-padding": 6,
        },
        paint: {
          "text-color": "rgba(255,255,255,0.92)",
          "text-halo-color": "rgba(6,10,20,0.85)",
          "text-halo-width": 1.3,
        },
      },
      {
        // Visible only in "Regions" mode; toggled in AtlasGlobe.
        id: LAYERS.regionLabel,
        type: "symbol",
        source: "region-labels",
        layout: {
          visibility: "none",
          "text-field": ["get", "name"],
          "text-font": ["Open Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 1, 11, 4, 17],
          "text-max-width": 9,
          "text-letter-spacing": 0.06,
          "text-transform": "uppercase",
        },
        paint: {
          "text-color": "rgba(255,255,255,0.96)",
          "text-halo-color": "rgba(6,10,20,0.9)",
          "text-halo-width": 1.6,
        },
      },
      ...COUNTRY_BADGE_BANDS.map((band) => topicBadgeLayer(band.id, "country-labels")),
      topicBadgeLayer(TOPIC_LAYERS.regions, "region-labels", { below: 3 }),
      // Groups have no name on the globe: the count sits on their centre.
      topicBadgeLayer(TOPIC_LAYERS.issue, "issue-labels", { below: -0.6 }),
    ],
  } as StyleSpecification;
}
