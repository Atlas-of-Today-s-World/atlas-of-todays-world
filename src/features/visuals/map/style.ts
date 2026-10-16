import type {
  DataDrivenPropertyValueSpecification,
  FilterSpecification,
  LayerSpecification,
  StyleSpecification,
} from "maplibre-gl";
import { glyphsUrl } from "@/components/map/glyphs";
import { COUNTRY_RANK_FILTER, GLOBE_DATA, satelliteSource } from "@/components/map/mapStyle";
import { GLOBE_COLORS, PLAIN_MAP_COLORS, THEME_COLORS } from "@/config/palette";
import type { MapCountryHighlight, MapView } from "./types";

/**
 * MapLibre style of a map visual. Only what the globe already loads: the
 * country borders (/data/countries.geo.json), their label points, the
 * glyphs and — for the satellite background — the globe's imagery. The
 * plain light map needs no tiles at all.
 */

export const VISUAL_LAYERS = {
  /** Every country, for a click in the builder (and the land colour of the light map). */
  land: "mv-land",
  highlight: "mv-highlight",
} as const;

/** A per-country value: `["match", iso3, "IRN", value, …, fallback]`, or just the fallback. */
function byCountry<T extends string | number>(
  highlights: readonly MapCountryHighlight[],
  value: (country: MapCountryHighlight) => T,
  fallback: T,
): DataDrivenPropertyValueSpecification<T> {
  if (!highlights.length) return fallback;
  return [
    "match",
    ["get", "iso3"],
    ...highlights.flatMap((country) => [country.iso3, value(country)]),
    fallback,
  ] as unknown as DataDrivenPropertyValueSpecification<T>;
}

const inCountries = (iso3s: string[]): FilterSpecification => [
  "in",
  ["get", "iso3"],
  ["literal", iso3s],
];

type StyleView = Pick<MapView, "basemap" | "projection" | "labels">;

export function buildVisualStyle(
  view: StyleView,
  highlights: readonly MapCountryHighlight[],
): StyleSpecification {
  const satellite = view.basemap === "satellite";
  const outlined = highlights.filter((country) => country.outline);
  const layers: LayerSpecification[] = [
    {
      id: "mv-background",
      type: "background",
      paint: {
        "background-color": satellite ? THEME_COLORS.spaceDeep : PLAIN_MAP_COLORS.water,
      },
    },
    ...(satellite
      ? [{ id: "mv-satellite", type: "raster", source: "satellite" } as LayerSpecification]
      : []),
    {
      id: VISUAL_LAYERS.land,
      type: "fill",
      source: "countries",
      paint: satellite
        ? { "fill-color": GLOBE_COLORS.land, "fill-opacity": 0.3 }
        : { "fill-color": PLAIN_MAP_COLORS.land, "fill-opacity": 1 },
    },
    {
      id: VISUAL_LAYERS.highlight,
      type: "fill",
      source: "countries",
      filter: inCountries(highlights.map((country) => country.iso3)),
      paint: {
        "fill-color": byCountry(highlights, (country) => country.fill, "#000000"),
        "fill-opacity": byCountry(highlights, (country) => country.opacity, 0),
      },
    },
    {
      id: "mv-border",
      type: "line",
      source: "countries",
      paint: {
        "line-color": satellite ? "rgba(255,255,255,0.45)" : PLAIN_MAP_COLORS.border,
        "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.4, 5, 1.1],
      },
    },
    {
      // Disputed territories keep the globe's dashed outline (src/data/territories.json).
      id: "mv-disputed",
      type: "line",
      source: "countries",
      filter: ["has", "status"],
      paint: {
        "line-color": satellite ? "rgba(255,255,255,0.85)" : PLAIN_MAP_COLORS.disputed,
        "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.8, 5, 1.8],
        "line-dasharray": [2.5, 1.8],
      },
    },
    {
      id: "mv-highlight-outline",
      type: "line",
      source: "countries",
      filter: inCountries(outlined.map((country) => country.iso3)),
      paint: {
        "line-color": byCountry(outlined, (country) => country.outline ?? "#000000", "#000000"),
        "line-width": ["interpolate", ["linear"], ["zoom"], 1, 1.2, 5, 2.4],
      },
    },
    {
      id: "mv-label",
      type: "symbol",
      source: "country-labels",
      minzoom: 1.6,
      filter: COUNTRY_RANK_FILTER as FilterSpecification,
      layout: {
        visibility: view.labels ? "visible" : "none",
        "text-field": ["get", "name"],
        "text-font": ["Open Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 1.6, 9.5, 3, 11.5, 6, 15],
        "text-max-width": 8,
        "text-padding": 6,
      },
      paint: satellite
        ? {
            "text-color": "rgba(255,255,255,0.92)",
            "text-halo-color": "rgba(6,10,20,0.85)",
            "text-halo-width": 1.3,
          }
        : {
            "text-color": PLAIN_MAP_COLORS.label,
            "text-halo-color": PLAIN_MAP_COLORS.labelHalo,
            "text-halo-width": 1.2,
          },
    },
  ];

  return {
    version: 8,
    projection: { type: view.projection },
    glyphs: glyphsUrl(),
    sources: {
      ...(satellite ? { satellite: { type: "raster", tileSize: 256, ...satelliteSource() } } : {}),
      countries: { type: "geojson", data: GLOBE_DATA.countries, promoteId: "iso3" },
      "country-labels": { type: "geojson", data: "/data/country-labels.geo.json" },
    },
    layers,
  };
}
