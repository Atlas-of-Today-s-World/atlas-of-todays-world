import type { ExpressionSpecification, Map as MapLibreMap } from "maplibre-gl";
import { loadMapLibre } from "../maplibre";
import {
  COUNTRY_BADGE_BANDS,
  LABEL_ZOOM_STATE,
  TOPIC_BADGE_IMAGES,
  TOPIC_LAYERS,
  fromLabelZoom,
  labelZoomAt,
} from "../mapStyle";
import { isCompleted, withProgressMark, withStatusMark } from "../global-issues";
import type { GroupStatus, RegionProgress } from "@/features/geography/content-status";
import { GLOBE_COLORS, THEME_COLORS } from "@/config/palette";

export type SelectionModeKey = keyof typeof TOPIC_LAYERS;

/** Fill and outline of each topic pill (TOPIC_BADGE_IMAGES). */
const BADGE_LOOK: Record<string, { fill: string; stroke: string }> = {
  [TOPIC_BADGE_IMAGES.some]: { fill: "#ffffff", stroke: "rgba(11,18,32,0.35)" },
  [TOPIC_BADGE_IMAGES.completed]: { fill: THEME_COLORS.statusReadyText, stroke: "#ffffff" },
  [TOPIC_BADGE_IMAGES.planned]: { fill: THEME_COLORS.statusPreparingText, stroke: "#ffffff" },
};

/** A pill behind a topic count, or null for an unknown id: rounded, stretchable around the number. */
export function topicBadgeImage(id: string) {
  const look = BADGE_LOOK[id];
  if (!look) return null;
  const ratio = 2;
  const [w, h, r] = [16 * ratio, 12 * ratio, 6 * ratio];
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = look.fill;
  ctx.strokeStyle = look.stroke;
  ctx.lineWidth = ratio;
  ctx.beginPath();
  ctx.roundRect(ratio / 2, ratio / 2, w - ratio, h - ratio, r);
  ctx.fill();
  ctx.stroke();
  return {
    image: ctx.getImageData(0, 0, w, h),
    options: {
      pixelRatio: ratio,
      stretchX: [[r, w - r]] as [number, number][],
      stretchY: [[r - 1, r + 1]] as [number, number][],
      content: [r / 2, ratio * 2, w - r / 2, h - ratio * 2] as [number, number, number, number],
    },
  };
}

/**
 * ISO3 / slug → count as MapLibre filter and label expressions for one badge
 * layer; `zero` is the text of a place without topics ("" hides it).
 */
function topicExpressions(counts: Record<string, number>, property: "iso3" | "slug", zero = "") {
  const keys = Object.keys(counts).filter((key) => counts[key]);
  const pairs = keys.flatMap((key) => [key, String(counts[key])]);
  const has: ExpressionSpecification = ["in", ["get", property], ["literal", keys]];
  // MapLibre types can't express a variable number of pairs in "match".
  const text = (keys.length
    ? ["match", ["get", property], ...pairs, zero]
    : ["literal", zero]) as unknown as ExpressionSpecification;
  return { has, text };
}

/** Status per country ISO3 (its region's progress) and per group slug, for each mode's pills. */
type PlaceStatuses = Record<SelectionModeKey, Record<string, GroupStatus>>;

/**
 * A mode's pill layers, each with the zoom it shows from (0: any) and its own
 * filter (null: set from the counts). The countries' come in COUNTRY_BADGE_BANDS.
 */
function badgeLayers(key: SelectionModeKey) {
  return key === "countries"
    ? COUNTRY_BADGE_BANDS.map((band) => ({
        ...band,
        filter: band.filter as ExpressionSpecification,
      }))
    : [{ id: TOPIC_LAYERS[key], zoom: 0, filter: null }];
}

/**
 * Topic counts: badge layers per mode, numbers from the server. Only the
 * active mode's pills show, and none in the corner window (`mini`).
 *
 * The hidden ones are only made transparent: a change of a layer's visibility
 * (or filter) has MapLibre's worker lay its tiles out again, and the pills
 * waited for that after every switch of mode or return from the corner window.
 */
export function applyTopicBadges(
  map: MapLibreMap,
  {
    topicCounts,
    statuses,
    mode,
    openIssue,
    mini,
  }: {
    topicCounts: Record<SelectionModeKey, Record<string, number>>;
    statuses: PlaceStatuses;
    mode: SelectionModeKey;
    openIssue: string | undefined;
    mini: boolean;
  },
) {
  const layers: [SelectionModeKey, "iso3" | "slug"][] = [
    ["countries", "iso3"],
    ["regions", "slug"],
    ["issue", "slug"],
  ];
  for (const [key, property] of layers) {
    // Countries and regions show 0 too (an open invitation to write);
    // a special region exists on the map only through its topics.
    const zero = key === "issue" ? "" : "0";
    const { has, text } = topicExpressions(topicCounts[key], property, zero);
    // The small globe window on full-width pages shows no counts.
    const shown = key === mode && !mini;
    for (const layer of badgeLayers(key)) {
      map.setFilter(
        layer.id,
        layer.filter ??
          (key === "regions"
            ? null
            : openIssue
              ? // On a group's page only its own count: another group's pill over one of
                // its countries reads as its count (Russia–Ukraine War over Belarus).
                ["all", has, ["==", ["get", "slug"], openIssue]]
              : has),
      );
      if (key === "issue") {
        // A global issue: the white pill, a check mark when ready, an hourglass in preparation.
        map.setLayoutProperty(
          layer.id,
          "text-field",
          withStatusMark(text, statuses.issue, property),
        );
        map.setLayoutProperty(layer.id, "icon-image", TOPIC_BADGE_IMAGES.some);
        map.setPaintProperty(layer.id, "text-color", GLOBE_COLORS.badgeText);
      } else {
        // A region and its countries carry the region's progress: a green pill with
        // a check mark once completed, an amber one with a calendar while planned.
        const completed = isCompleted(statuses[key], property);
        map.setLayoutProperty(layer.id, "text-field", withProgressMark(text, completed));
        map.setLayoutProperty(layer.id, "icon-image", [
          "case",
          completed,
          TOPIC_BADGE_IMAGES.completed,
          TOPIC_BADGE_IMAGES.planned,
        ]);
        map.setPaintProperty(layer.id, "text-color", "#ffffff");
      }
      // Opacity by the label zoom only (no feature data): changing it never
      // has the tiles laid out again.
      const opacity = (full: number) =>
        (!shown ? 0 : layer.zoom ? fromLabelZoom(layer.zoom, full) : full) as
          number | ExpressionSpecification;
      map.setPaintProperty(layer.id, "icon-opacity", opacity(key === "issue" ? 0.95 : 1));
      map.setPaintProperty(layer.id, "text-opacity", opacity(1));
    }
  }
}

/**
 * Keeps the label zoom (LABEL_ZOOM_STATE) in step with the camera. It changes
 * only at whole zooms, so names are laid out again only then.
 */
export function syncLabelZoom(map: MapLibreMap) {
  map.setGlobalStateProperty(LABEL_ZOOM_STATE, labelZoomAt(map.getZoom(), map.getCenter().lat));
}

/** Topic badges that pulse per beat of the idle spin. */
const PULSES_PER_BEAT = 2;
/** Matches the topic-pulse animation in globals.css. */
const PULSE_MS = 1600;
/** Ems from the label point to the badge, per mode (as in mapStyle's badge layers). */
const BADGE_BELOW: Record<SelectionModeKey, number> = { countries: 1.35, regions: 3, issue: -0.6 };

/**
 * Two random badges near the middle of the globe briefly grow and settle back,
 * a hint that places can be clicked. A copy of the pill rides as a marker over
 * the badge: MapLibre can't scale one symbol of a layer without laying out the
 * whole source again.
 */
export function pulseTopicBadges(
  map: MapLibreMap,
  mode: SelectionModeKey,
  numberOf: (key: string) => number,
  progressOf: (key: string) => RegionProgress | undefined,
) {
  const canvas = map.getCanvas();
  const [w, h] = [canvas.clientWidth, canvas.clientHeight];
  // The middle of the view only: badges at the globe's rim are squeezed and hard to see.
  const features = map.queryRenderedFeatures(
    [
      [w * 0.2, h * 0.2],
      [w * 0.8, h * 0.8],
    ],
    // Only the pills shown at this zoom (the others are there, transparent).
    {
      layers: badgeLayers(mode).flatMap((layer) =>
        !layer.zoom || layer.zoom <= (map.getGlobalState()[LABEL_ZOOM_STATE] as number)
          ? [layer.id]
          : [],
      ),
    },
  );
  const property = mode === "countries" ? "iso3" : "slug";
  const points = new Map<string, [number, number]>();
  for (const feature of features) {
    const key = feature.properties?.[property] as string | undefined;
    if (key && feature.geometry.type === "Point") {
      points.set(key, feature.geometry.coordinates as [number, number]);
    }
  }
  const picked = [...points].sort(() => Math.random() - 0.5).slice(0, PULSES_PER_BEAT);
  if (!picked.length) return;
  void loadMapLibre().then(({ Marker }) => {
    for (const [key, lngLat] of picked) {
      const count = numberOf(key);
      const element = document.createElement("div");
      element.setAttribute("aria-hidden", "true");
      element.style.pointerEvents = "none";
      const pill = document.createElement("span");
      // A region's or country's pill is in its region's progress colour.
      const progress = progressOf(key);
      pill.className = progress ? `topic-pulse topic-pulse-${progress}` : "topic-pulse";
      pill.textContent = String(count);
      element.append(pill);
      const marker = new Marker({
        element,
        anchor: "top",
        // The pill's padding reaches above the text box the badge is anchored by.
        offset: [0, BADGE_BELOW[mode] * 10 - 1.5],
      })
        .setLngLat(lngLat)
        .addTo(map);
      window.setTimeout(() => marker.remove(), PULSE_MS);
    }
  });
}
