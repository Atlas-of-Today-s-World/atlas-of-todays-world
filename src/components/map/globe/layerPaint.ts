import type { ExpressionSpecification, Map as MapLibreMap } from "maplibre-gl";
import type { SelectionMode } from "../MapContext";
import { LAYERS } from "../mapStyle";
import type { GlobeColorSets, RegionLookup } from "./types";

const NEUTRAL = "#7d8aa8";
/** Countries outside the open global issue: grey and faint, so its members stand out. */
const DIMMED = "#5b6273";
/** Places whose content nobody has started yet: a light grey wash instead of the region colour. */
const UNPROCESSED = "#c9ced8";

/** Turns an ISO3->color map into a MapLibre `match` expression. */
function matchExpression(colors: Record<string, string>): ExpressionSpecification {
  const stops: string[] = [];
  for (const [iso3, color] of Object.entries(colors)) stops.push(iso3, color);
  if (!stops.length) return ["literal", NEUTRAL];
  // MapLibre types can't express a variable number of key–color pairs in "match".
  return ["match", ["get", "iso3"], ...stops, NEUTRAL] as unknown as ExpressionSpecification;
}

/**
 * Colours the countries by the selected layer: the encyclopedia (region / issue
 * colours) or a metric. A metric still on its way keeps the current colours.
 */
export function paintLayer(
  map: MapLibreMap,
  {
    colorSets,
    metricColors,
    view,
    mode,
    openIssue,
    issue,
    unprocessed,
  }: {
    colorSets: GlobeColorSets;
    /** Colours of the loaded metric layer for `view`, if any. */
    metricColors: Record<string, string> | undefined;
    view: string;
    mode: SelectionMode;
    openIssue: string | undefined;
    issue: RegionLookup;
    /** Countries of the regions nobody has started on. */
    unprocessed: string[];
  },
) {
  const isData = view !== "encyclopedia";
  const layerColors = colorSets[view] ?? metricColors;
  // A metric still on its way: keep the current colours until it arrives.
  if (isData && !layerColors) return;
  const colors =
    mode === "issue" && !isData
      ? (colorSets.issue ?? {})
      : (layerColors ?? colorSets.encyclopedia ?? {});
  let fillColor = matchExpression(colors);
  let fillOpacity: number | ExpressionSpecification = isData ? 0.88 : 0.55;
  const focused = mode === "issue" && openIssue ? issue.bySlug[openIssue] : undefined;
  if (focused) {
    // An open global issue: its countries lit (in the issue's colour, or the data
    // layer's), every other country greyed out over a desaturated globe. One paint
    // update when the issue changes; nothing is redone while the globe moves.
    const member: ExpressionSpecification = ["in", ["get", "iso3"], ["literal", focused.countries]];
    fillColor = ["case", member, isData ? fillColor : focused.fill, DIMMED];
    fillOpacity = ["case", member, isData ? 0.9 : 0.72, 0.55];
  } else if (mode === "regions" && !isData && unprocessed.length) {
    // Regions nobody has started on yet: a light grey wash, "not processed yet".
    const unstarted: ExpressionSpecification = ["in", ["get", "iso3"], ["literal", unprocessed]];
    fillColor = ["case", unstarted, UNPROCESSED, fillColor];
    fillOpacity = ["case", unstarted, 0.32, fillOpacity];
  }
  map.setPaintProperty(LAYERS.fill, "fill-color", fillColor);
  map.setPaintProperty(LAYERS.fill, "fill-opacity", fillOpacity);

  // Data layers want legible fills, the encyclopedia wants to see the terrain.
  map.setPaintProperty(LAYERS.satellite, "raster-opacity", isData ? 0.28 : 1);
  map.setPaintProperty(
    LAYERS.satellite,
    "raster-saturation",
    focused ? -0.9 : isData ? -0.6 : -0.35,
  );
  map.setPaintProperty(
    LAYERS.border,
    "line-color",
    isData ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.4)",
  );
}

/**
 * Selection mode: countries vs. groups. In the group modes internal borders and
 * country names recede into the background, so the coloured groups read as regions.
 */
export function paintSelectionMode(map: MapLibreMap, mode: SelectionMode) {
  const isGrouped = mode !== "countries";
  map.setPaintProperty(LAYERS.border, "line-opacity", isGrouped ? 0.25 : 1);
  map.setLayoutProperty(LAYERS.label, "visibility", isGrouped ? "none" : "visible");
  map.setLayoutProperty(LAYERS.regionLabel, "visibility", mode === "regions" ? "visible" : "none");
}
