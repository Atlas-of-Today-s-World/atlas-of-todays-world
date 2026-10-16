import type { ExpressionSpecification, Map as MapLibreMap } from "maplibre-gl";
import { loadMapLibre } from "../maplibre";
import { COUNTRY_RANK_FILTER, TOPIC_BADGE_IMAGES, TOPIC_LAYERS } from "../mapStyle";
import { STATUS_IMAGES, withStatusMark } from "../global-issues";
import type { ContentStatus } from "@/features/geography/content-status";
import { GLOBE_COLORS } from "@/config/palette";

export type SelectionModeKey = keyof typeof TOPIC_LAYERS;

/** The pill behind a topic count: white, rounded, stretchable around the number. */
export function topicBadgeImage() {
  const ratio = 2;
  const [w, h, r] = [16 * ratio, 12 * ratio, 6 * ratio];
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "rgba(11,18,32,0.35)";
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

/** Content status per country ISO3 and per group slug, for each mode's pills. */
type PlaceStatuses = Record<SelectionModeKey, Record<string, ContentStatus>>;

/**
 * Topic counts: one badge layer per mode, numbers from the server. Only the
 * active mode's layer shows, and none in the corner window (`mini`).
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
    const layer = TOPIC_LAYERS[key];
    map.setFilter(
      layer,
      key === "countries"
        ? (COUNTRY_RANK_FILTER as ExpressionSpecification)
        : key === "regions"
          ? null
          : openIssue
            ? // On a group's page only its own count: another group's pill over one of
              // its countries reads as its count (Russia–Ukraine War over Belarus).
              ["all", has, ["==", ["get", "slug"], openIssue]]
            : has,
    );
    // Pills carry the content status: a check mark when ready, an hourglass in
    // preparation; a country without its own content yet gets a dashed ring.
    map.setLayoutProperty(
      layer,
      "text-field",
      key === "countries"
        ? withStatusMark(text, statuses.countries, property, STATUS_IMAGES.missing)
        : withStatusMark(text, statuses[key], property),
    );
    // The small globe window on full-width pages shows no counts.
    map.setLayoutProperty(layer, "visibility", key === mode && !mini ? "visible" : "none");
    // The same white pill with or without topics.
    map.setLayoutProperty(layer, "icon-image", TOPIC_BADGE_IMAGES.some);
    map.setPaintProperty(layer, "text-color", GLOBE_COLORS.badgeText);
    map.setPaintProperty(layer, "icon-opacity", 0.95);
    map.setPaintProperty(layer, "text-opacity", 1);
  }
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
) {
  const canvas = map.getCanvas();
  const [w, h] = [canvas.clientWidth, canvas.clientHeight];
  // The middle of the view only: badges at the globe's rim are squeezed and hard to see.
  const features = map.queryRenderedFeatures(
    [
      [w * 0.2, h * 0.2],
      [w * 0.8, h * 0.8],
    ],
    { layers: [TOPIC_LAYERS[mode]] },
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
      pill.className = "topic-pulse";
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
