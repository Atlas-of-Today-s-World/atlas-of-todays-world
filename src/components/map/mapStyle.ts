import type { GeoJSONSourceSpecification, StyleSpecification } from "maplibre-gl";
import { publicEnv } from "@/lib/env";

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

/** Group labels – one point per region or global issue, at its hand-picked center. */
function regionLabelSource(regions: RegionLabel[]): GeoJSONSourceSpecification {
  return {
    type: "geojson",
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
    "https://fonts.openmaptiles.org",
  ],
  countries: "/data/countries.geo.json",
} as const;

/**
 * Satellite basemap. With a MapTiler key we use their tiles, without a key
 * Esri World Imagery (free, requires attribution).
 */
function satelliteSource() {
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

/** Topic count badges, one layer per globe mode (filters and numbers are set at runtime). */
export const TOPIC_LAYERS = {
  countries: "topic-count-country",
  regions: "topic-count-region",
  issue: "topic-count-issue",
} as const;

/**
 * Pills behind a topic count (drawn in AtlasGlobe on `styleimagemissing`).
 * One look for countries, regions and special regions alike: the number is how
 * many topics are linked to the place — solid with topics, soft and faint at 0.
 */
export const TOPIC_BADGE_IMAGES = { some: "topic-badge", none: "topic-badge-soft" } as const;

/** Same rule as country names: small countries appear only when zoomed in. */
export const COUNTRY_RANK_FILTER = ["<=", ["get", "rank"], ["+", 0.5, ["*", 1.45, ["zoom"]]]];

/**
 * A topic count under a label: a small pill that never hides a place name
 * (placed regardless of collisions and ignored by them).
 */
function topicBadgeLayer(id: string, source: string, { minzoom = 0, below = 1.35 } = {}) {
  return {
    id,
    type: "symbol" as const,
    source,
    minzoom,
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
      "text-color": "#0b1220",
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
    glyphs: "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf",
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
      "fog-color": "#0a1020",
      "fog-ground-blend": 0.05,
      "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 4, 0.6, 6, 0],
    },
    // Even lighting: a day/night terminator would drown half the globe in darkness.
    light: { anchor: "viewport", position: [1.15, 210, 30], intensity: 0.05 },
    layers: [
      { id: "space", type: "background", paint: { "background-color": "#070b16" } },
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
        paint: { "fill-color": "#7d8aa8", "fill-opacity": 0.61 },
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
        // Low, so country names are legible even in a small window where the sphere
        // fills the area at a lower zoom.
        minzoom: 1.6,
        // LABELRANK: 1 = large countries, 8 = tiny territories. Smaller ones appear only when zoomed in.
        filter: COUNTRY_RANK_FILTER,
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
      topicBadgeLayer(TOPIC_LAYERS.countries, "country-labels", { minzoom: 1.6 }),
      topicBadgeLayer(TOPIC_LAYERS.regions, "region-labels", { below: 3 }),
      // Groups have no name on the globe: the count sits on their centre.
      topicBadgeLayer(TOPIC_LAYERS.issue, "issue-labels", { below: -0.6 }),
    ],
  } as StyleSpecification;
}
