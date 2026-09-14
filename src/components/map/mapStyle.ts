import type {
  FilterSpecification,
  GeoJSONSourceSpecification,
  StyleSpecification,
} from "maplibre-gl";
import { REGIONS } from "@/data/regions";

/** Popisky regionů – jeden bod na region, pozice je ručně zvolený střed. */
function regionLabelSource(): GeoJSONSourceSpecification {
  return {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: REGIONS.map((region) => ({
        type: "Feature" as const,
        properties: { name: region.name, slug: region.slug },
        geometry: { type: "Point" as const, coordinates: region.center },
      })),
    },
  };
}

/**
 * Satelitní podklad. S MapTiler klíčem jedeme na jejich dlaždice, bez klíče
 * na Esri World Imagery (zdarma, vyžaduje uvedení zdroje).
 */
function satelliteSource() {
  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  if (key) {
    return {
      tiles: [`https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=${key}`],
      attribution:
        '<a href="https://www.maptiler.com/copyright/">MapTiler</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxzoom: 20,
    };
  }
  return {
    tiles: [
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    ],
    attribution:
      'Imagery © <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics',
    maxzoom: 18,
  };
}

export const LAYERS = {
  satellite: "satellite",
  fill: "country-fill",
  countryHover: "country-hover",
  regionHover: "region-hover",
  border: "country-border",
  regionOutline: "region-outline",
  activeOutline: "active-outline",
  label: "country-label",
  regionLabel: "region-label",
} as const;

/** Prázdný filtr – vrstva se nevykreslí, dokud jí nedáme konkrétní země. */
export const NO_FEATURES: FilterSpecification = [
  "==",
  ["get", "iso3"],
  "___none___",
];

/** Filtr na jednu zemi. */
export function onlyCountry(iso3: string | null): FilterSpecification {
  return iso3 ? ["==", ["get", "iso3"], iso3] : NO_FEATURES;
}

/** Filtr na seznam zemí (např. všechny státy regionu). */
export function anyOfCountries(list: string[]): FilterSpecification {
  return list.length ? ["in", ["get", "iso3"], ["literal", list]] : NO_FEATURES;
}

/**
 * Styl globusu. Obarvení zemí neřešíme tady – přepisuje se za běhu přes
 * `setPaintProperty`, aby přepnutí vrstvy (Encyclopedia / HDI / ...) nemuselo
 * přenačítat celý styl a ztratit pozici kamery.
 */
export function buildStyle(): StyleSpecification {
  const satellite = satelliteSource();

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
      // Jeden bod na zemi: jinak by MultiPolygon vysázel popisek na každý ostrov.
      "country-labels": {
        type: "geojson",
        data: "/data/country-labels.geo.json",
      },
      "region-labels": regionLabelSource(),
    },
    sky: {
      "sky-color": "#0b1a3a",
      "sky-horizon-blend": 0.5,
      "horizon-color": "#4a6fa5",
      "horizon-fog-blend": 0.6,
      "fog-color": "#0a1020",
      "fog-ground-blend": 0.05,
      "atmosphere-blend": [
        "interpolate",
        ["linear"],
        ["zoom"],
        0,
        1,
        4,
        0.6,
        6,
        0,
      ],
    },
    // Rovnoměrné nasvícení: den/noc terminátor by polovinu globusu utopil ve tmě.
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
        paint: { "fill-color": "#7d8aa8", "fill-opacity": 0.55 },
      },
      {
        // Zvýraznění pod kurzorem. Samostatné vrstvy s filtrem jsou levnější
        // než přepisování feature-state u desítek zemí najednou.
        id: LAYERS.countryHover,
        type: "fill",
        source: "countries",
        filter: NO_FEATURES,
        paint: { "fill-color": "#ffffff", "fill-opacity": 0.2 },
      },
      {
        id: LAYERS.regionHover,
        type: "fill",
        source: "countries",
        filter: NO_FEATURES,
        paint: { "fill-color": "#ffffff", "fill-opacity": 0.22 },
      },
      {
        id: LAYERS.border,
        type: "line",
        source: "countries",
        paint: {
          "line-color": "rgba(255,255,255,0.45)",
          "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.3, 5, 1.1],
        },
      },
      {
        id: LAYERS.regionOutline,
        type: "line",
        source: "countries",
        filter: NO_FEATURES,
        paint: {
          "line-color": "#b03a2e",
          "line-width": ["interpolate", ["linear"], ["zoom"], 1, 1, 5, 2.4],
        },
      },
      {
        id: LAYERS.activeOutline,
        type: "line",
        source: "countries",
        filter: NO_FEATURES,
        paint: {
          "line-color": "#ffffff",
          "line-width": ["interpolate", ["linear"], ["zoom"], 1, 1.4, 5, 3],
          "line-blur": 0.3,
        },
      },
      {
        id: LAYERS.label,
        type: "symbol",
        source: "country-labels",
        minzoom: 2.2,
        // LABELRANK: 1 = velké státy, 8 = drobná území. Menší se objeví až v zoomu.
        filter: ["<=", ["get", "rank"], ["+", 1, ["*", 1.1, ["zoom"]]]],
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 2.2, 10.5, 6, 15],
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
        // Viditelné jen v režimu "Regions"; zapíná se v AtlasGlobe.
        id: LAYERS.regionLabel,
        type: "symbol",
        source: "region-labels",
        layout: {
          visibility: "none",
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Regular"],
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

