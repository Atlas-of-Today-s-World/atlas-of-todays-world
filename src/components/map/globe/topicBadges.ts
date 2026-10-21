import type { ExpressionSpecification, Map as MapLibreMap } from "maplibre-gl";
import { loadMapLibre } from "../maplibre";
import {
  COUNTRY_BADGE_BANDS,
  LABEL_ZOOM_STATE,
  REGION_PILL_SUFFIX,
  TOPIC_BADGE_IMAGES,
  TOPIC_LAYERS,
  fromLabelZoom,
  labelZoomAt,
} from "../mapStyle";
import {
  PILL_ICONS,
  entriesPillText,
  isCompleted,
  regionPillText,
  withStatusMark,
} from "../global-issues";
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

/**
 * ISO3 / slug → "published/planned" (the region's whole entry plan, `totals`)
 * as a MapLibre label expression; a place with neither reads "0/0".
 */
export function fractionText(
  published: Record<string, number>,
  totals: Record<string, number>,
  property: "iso3" | "slug",
) {
  const keys = [...new Set([...Object.keys(published), ...Object.keys(totals)])];
  const pairs = keys.flatMap((key) => {
    const done = published[key] ?? 0;
    return [key, `${done}/${Math.max(totals[key] ?? 0, done)}`];
  });
  // MapLibre types can't express a variable number of pairs in "match".
  return (keys.length
    ? ["match", ["get", property], ...pairs, "0/0"]
    : ["literal", "0/0"]) as unknown as ExpressionSpecification;
}

/** Status per country ISO3 (its region's progress) and per group slug, for each mode's pills. */
type PlaceStatuses = Record<SelectionModeKey, Record<string, GroupStatus>>;

/**
 * A mode's pill layers, each with the zoom it shows from (0: any) and its own
 * filter (null: set from the counts). The countries' come in COUNTRY_BADGE_BANDS;
 * on a phone each band past the largest countries comes a zoom later (PHONE_PILL_DELAY).
 */
function badgeLayers(key: SelectionModeKey, phone: boolean) {
  return key === "countries"
    ? COUNTRY_BADGE_BANDS.map((band) => ({
        ...band,
        zoom: band.zoom && phone ? band.zoom + PHONE_PILL_DELAY : band.zoom,
        filter: band.filter as ExpressionSpecification,
      }))
    : [{ id: TOPIC_LAYERS[key], zoom: 0, filter: null }];
}

/**
 * Zooms a phone waits longer for the smaller countries' pills: its home view
 * (zoom 2) shows only the largest countries' pairs of pills, which already
 * fill a phone's screen; the rest come with zooming in. Names are unchanged.
 */
const PHONE_PILL_DELAY = 1;

/**
 * Topic counts: badge layers per mode, numbers from the server. Only the
 * active mode's pills show, and none in the corner window (`mini`).
 *
 * A region and its countries get a pair of pills: the region pill (a globe in
 * the region's progress colour, a check mark once completed, a calendar while
 * planned) and the entries pill ("published / planned" topics of the region).
 * A global issue keeps its one pill: the count and its status mark.
 *
 * The hidden ones are only made transparent: a change of a layer's visibility
 * (or filter) has MapLibre's worker lay its tiles out again, and the pills
 * waited for that after every switch of mode or return from the corner window.
 */
export function applyTopicBadges(
  map: MapLibreMap,
  {
    topicCounts,
    topicTotals,
    statuses,
    mode,
    openIssue,
    mini,
    phone,
  }: {
    topicCounts: Record<SelectionModeKey, Record<string, number>>;
    /** A region's whole entry plan, published and planned (the "/ 10"). */
    topicTotals: Record<Exclude<SelectionModeKey, "issue">, Record<string, number>>;
    statuses: PlaceStatuses;
    mode: SelectionModeKey;
    openIssue: string | undefined;
    mini: boolean;
    /** A phone-sized window (PHONE_PILL_DELAY). */
    phone: boolean;
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
    for (const layer of badgeLayers(key, phone)) {
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
      } else {
        map.setLayoutProperty(
          layer.id,
          "text-field",
          entriesPillText(fractionText(topicCounts[key], topicTotals[key], property)),
        );
        // The region pill beside it: the region's progress, green once completed,
        // amber while planned.
        const completed = isCompleted(statuses[key], property);
        const region = layer.id + REGION_PILL_SUFFIX;
        map.setFilter(region, layer.filter ?? null);
        map.setLayoutProperty(region, "text-field", regionPillText(completed));
        map.setLayoutProperty(region, "icon-image", [
          "case",
          completed,
          TOPIC_BADGE_IMAGES.completed,
          TOPIC_BADGE_IMAGES.planned,
        ]);
        map.setPaintProperty(region, "text-color", "#ffffff");
      }
      map.setLayoutProperty(layer.id, "icon-image", TOPIC_BADGE_IMAGES.some);
      map.setPaintProperty(layer.id, "text-color", GLOBE_COLORS.badgeText);
      // Opacity by the label zoom only (no feature data): changing it never
      // has the tiles laid out again.
      const opacity = (full: number) =>
        (!shown ? 0 : layer.zoom ? fromLabelZoom(layer.zoom, full) : full) as
          number | ExpressionSpecification;
      const ids = key === "issue" ? [layer.id] : [layer.id, layer.id + REGION_PILL_SUFFIX];
      for (const id of ids) {
        map.setPaintProperty(id, "icon-opacity", opacity(key === "issue" ? 0.95 : 1));
        map.setPaintProperty(id, "text-opacity", opacity(1));
      }
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

/** An icon (PILL_ICONS) as inline SVG for the pulse's copy of a pill. */
function iconSvg(paths: readonly string[], size: number) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2.2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  for (const d of paths) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    svg.append(path);
  }
  return svg;
}

/**
 * Two random badges near the middle of the globe briefly grow and settle back,
 * a hint that places can be clicked. A copy of the pill (a region's or
 * country's pair of pills) rides as a marker over the badge: MapLibre can't
 * scale one symbol of a layer without laying out the whole source again.
 */
export function pulseTopicBadges(
  map: MapLibreMap,
  mode: SelectionModeKey,
  textOf: (key: string) => string,
  progressOf: (key: string) => RegionProgress | undefined,
  phone: boolean,
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
      layers: badgeLayers(mode, phone).flatMap((layer) =>
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
      const element = document.createElement("div");
      element.setAttribute("aria-hidden", "true");
      element.style.pointerEvents = "none";
      const progress = progressOf(key);
      if (mode === "issue" || !progress) {
        const pill = document.createElement("span");
        pill.className = "topic-pulse";
        pill.textContent = textOf(key);
        element.append(pill);
      } else {
        // The pair, each pill on its side of the label's centre (as on the globe).
        element.className = "topic-pulse-pair";
        const region = document.createElement("span");
        region.className = `topic-pulse topic-pulse-${progress}`;
        region.append(
          iconSvg(PILL_ICONS.globe, 12),
          iconSvg(progress === "completed" ? PILL_ICONS.check : PILL_ICONS.calendar, 9.5),
        );
        const entries = document.createElement("span");
        entries.className = "topic-pulse";
        entries.append(iconSvg(PILL_ICONS.book, 11), textOf(key));
        element.append(region, entries);
      }
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
