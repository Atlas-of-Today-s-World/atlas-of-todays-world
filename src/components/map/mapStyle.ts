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
}

export interface RegionLabel {
  slug: string;
  name: string;
  center: [number, number];
}

/** Region labels – one point per region, positioned at a hand-picked center. */
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
        data: "/data/countries.geo.json",
        promoteId: "iso3",
      },
      // One point per country: otherwise a MultiPolygon would place a label on every island.
      "country-labels": {
        type: "geojson",
        data: "/data/country-labels.geo.json",
      },
      "region-labels": regionLabelSource(regions),
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
        filter: ["<=", ["get", "rank"], ["+", 0.5, ["*", 1.45, ["zoom"]]]],
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
    ],
  } as StyleSpecification;
}
