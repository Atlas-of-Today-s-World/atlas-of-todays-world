"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useLocalizedRouter } from "@/components/i18n/useLocalizedRouter";
import type {
  Map as MapLibreMap,
  ErrorEvent,
  ExpressionSpecification,
  MapMouseEvent,
  MapSourceDataEvent,
} from "maplibre-gl";
import { Minus, Plus } from "lucide-react";
import { loadMapLibre } from "./maplibre";
import {
  buildStyle,
  COUNTRY_RANK_FILTER,
  LAYERS,
  TOPIC_BADGE_IMAGES,
  TOPIC_LAYERS,
  type RegionLabel,
  type StyleOptions,
} from "./mapStyle";
import { format } from "@/features/i18n/messages";
import { EUROPE_CENTER, globeFillZoom, miniGlobeZoom } from "@/lib/home-location";
import { useMapState } from "./MapContext";
import { useLatest } from "@/lib/use-latest";
import { DESKTOP_MIN_PX, MOBILE_SHEET, isFullPage, railKind, railWidthPx } from "@/config/layout";
import Link from "@/components/i18n/Link";
import { cn } from "@/lib/cn";
import { useMessages } from "@/components/i18n/LocaleProvider";
import { splitLocale, withoutDefaultPrefix } from "@/features/i18n/config";
import { isSpinEvent, useIdleSpin } from "./useIdleSpin";

interface GlobeColorSets {
  /** ISO3 -> color for each layer, precomputed on the server. */
  [view: string]: Record<string, string>;
}

export interface RegionLookup {
  /** ISO3 -> slug regionu. */
  slugByCountry: Record<string, string>;
  /** region slug -> its countries and name. */
  bySlug: Record<string, { name: string; countries: string[] }>;
}

/** Metric id → its short name and each country's formatted value and year (hover label). */
export type MetricValues = Record<
  string,
  { label: string; values: Record<string, [value: string, year: number]> }
>;

/** What the label under the cursor says. */
interface HoverLabel {
  name: string;
  /** The active metric for this country (countries mode with a metric on). */
  metric?: { label: string; value: string | null; year?: number };
  topics?: string;
}

interface Props {
  colorSets: GlobeColorSets;
  metricValues: MetricValues;
  /** ISO3 -> country slug, for navigation on click. */
  slugs: Record<string, string>;
  regions: RegionLookup;
  /** Editorial Global Issues; empty when there are none. */
  issue: RegionLookup;
  /** Region labels over the globe. */
  regionLabels: RegionLabel[];
  /** Appearance and custom areas from the admin. */
  styleOptions: StyleOptions;
  /** Number of topics per place, for each selection mode (ISO3 or group slug → count). */
  topicCounts: Record<SelectionModeKey, Record<string, number>>;
  /** Countries with a topic of their own (solid pill); the others only inherit (soft pill). */
  ownTopicCountries: string[];
}

type SelectionModeKey = keyof typeof TOPIC_LAYERS;

/** The pill behind a topic count: rounded, stretchable around the number. */
function topicBadgeImage(soft: boolean) {
  const ratio = 2;
  const [w, h, r] = [16 * ratio, 12 * ratio, 6 * ratio];
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = soft ? "rgba(8,14,28,0.55)" : "#ffffff";
  ctx.strokeStyle = soft ? "rgba(255,255,255,0.75)" : "rgba(11,18,32,0.35)";
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
function pulseTopicBadges(
  map: MapLibreMap,
  mode: SelectionModeKey,
  numberOf: (key: string) => number,
  isOwn: (key: string) => boolean,
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
      pill.className = count && isOwn(key) ? "topic-pulse" : "topic-pulse topic-pulse-soft";
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

const NEUTRAL = "#7d8aa8";
/** Closest zoom on the full map; the corner window on full-width pages goes below it. */
const MIN_ZOOM = 0.8;
/** Globe ↔ corner window transition (matches the wrapper's CSS transition). */
const WINDOW_MS = 700;
/** Upper bound for the globe canvas pixel ratio (see the Map options). */
const MAX_PIXEL_RATIO = 1.5;

/**
 * Viewport padding so the content panel doesn't cover the country — on desktop
 * the right column, wide or narrow depending on the path being navigated to; on
 * phones the bottom sheet, with the place on the strip of globe above it (the map
 * controls step aside there while a panel is open). Tokens from config/layout.ts.
 */
function railPadding() {
  if (typeof window === "undefined") return 60;
  if (window.innerWidth < DESKTOP_MIN_PX) {
    return {
      top: 16,
      bottom: Math.round(window.innerHeight * MOBILE_SHEET.ratio) + 16,
      left: 24,
      right: 24,
    };
  }
  const rail = railWidthPx(railKind(window.location.pathname), window.innerWidth);
  return { top: 110, bottom: 90, left: 60, right: rail + 40 };
}

type StateKey = "hover" | "inRegion" | "active";

/**
 * Toggles feature-state for the given countries and turns off the previous ones.
 * The ref holds what's currently lit, so only the difference is touched.
 */
function applyFeatureState(
  map: MapLibreMap,
  ref: { current: string[] },
  next: string[],
  key: StateKey,
) {
  const nextSet = new Set(next);
  for (const iso3 of ref.current) {
    if (!nextSet.has(iso3)) {
      map.setFeatureState({ source: "countries", id: iso3 }, { [key]: false });
    }
  }
  const previous = new Set(ref.current);
  for (const iso3 of next) {
    if (!previous.has(iso3)) {
      map.setFeatureState({ source: "countries", id: iso3 }, { [key]: true });
    }
  }
  ref.current = next;
}

const setHoverState = (map: MapLibreMap, ref: { current: string[] }, next: string[]) =>
  applyFeatureState(map, ref, next, "hover");

/** Turns an ISO3->color map into a MapLibre `match` expression. */
function matchExpression(colors: Record<string, string>): ExpressionSpecification {
  const stops: string[] = [];
  for (const [iso3, color] of Object.entries(colors)) stops.push(iso3, color);
  if (!stops.length) return ["literal", NEUTRAL];
  // MapLibre types can't express a variable number of key–color pairs in "match".
  return ["match", ["get", "iso3"], ...stops, NEUTRAL] as unknown as ExpressionSpecification;
}

export default function AtlasGlobe({
  colorSets,
  metricValues,
  slugs,
  regions,
  issue,
  regionLabels,
  styleOptions,
  topicCounts,
  ownTopicCountries,
}: Props) {
  const t = useMessages();
  const containerRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const hoveredRef = useRef<string | null>(null);
  const readyRef = useRef(false);
  const router = useLocalizedRouter();
  const { focus, view, mode } = useMapState();
  const [hoverLabel, setHoverLabel] = useState<HoverLabel | null>(null);
  const [ready, setReady] = useState(false);
  /** The country just clicked – we highlight it before the content arrives. */
  // Valid until the active country changes (since) — then the page takes over.
  const [pending, setPending] = useState<{ iso3: string; since: string | null } | null>(null);
  const pendingIso3 = pending && pending.since === focus.activeIso3 ? pending.iso3 : null;

  // Mouse handling changes with the mode, but we don't recreate the map for that.
  const modeRef = useLatest(mode);
  const regionsRef = useLatest(regions);
  const issueRef = useLatest(issue);
  const slugsRef = useLatest(slugs);
  const topicCountsRef = useLatest(topicCounts);
  const metricValuesRef = useLatest(metricValues);
  const viewRef = useLatest(view);
  const ownTopicCountriesRef = useLatest(ownTopicCountries);
  const topicLabelRef = useLatest((count: number) =>
    count === 1 ? t.map.topicsOne : format(t.map.topicsCount, { count: String(count) }),
  );
  const activeRef = useLatest(focus.activeIso3);
  /** URLs we've already prefetched – so we don't prefetch the same on every move. */
  const prefetchedRef = useRef(new Set<string>());
  /** Last cursor position over the map, for recomputing after the camera settles. */
  const cursorRef = useRef<MapMouseEvent["point"] | null>(null);
  // What's currently lit in feature-state, so changes only touch the difference.
  const hoveredIsoRef = useRef<string[]>([]);
  const regionIsoRef = useRef<string[]>([]);
  const activeIsoRef = useRef<string[]>([]);

  const pathname = usePathname();
  /** Full-width page (Topics, entry): the globe waits in a small window bottom left. */
  const mini = isFullPage(pathname);

  // On the home map (and in the corner window) the globe turns slowly until the user grabs it,
  // and now and then two topic counts pulse to invite a click.
  useIdleSpin(mapRef, surfaceRef, ready, railKind(pathname) === "none", () => {
    const map = mapRef.current;
    if (!map || document.hidden) return;
    const key = modeRef.current;
    pulseTopicBadges(
      map,
      key,
      (place) => topicCountsRef.current[key][place] ?? 0,
      (place) => key !== "countries" || ownTopicCountriesRef.current.includes(place),
    );
  });

  // --- map initialization (only once for the app's whole lifetime) ---
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;
    // MapLibre i jeho worker z public/ (loadMapLibre, ADR-017).
    void loadMapLibre().then(({ Map: MapLibreMap, AttributionControl }) => {
      if (cancelled || !containerRef.current) return;
      const map = new MapLibreMap({
        container: containerRef.current,
        style: buildStyle(regionLabels, styleOptions),
        // First frame straight at the default distance, so the map doesn't first
        // appear as a tiny ball and only then fly in.
        center: EUROPE_CENTER,
        zoom: globeFillZoom(),
        minZoom: MIN_ZOOM,
        maxZoom: 9,
        // Added below in the bottom-left corner (the right one holds the donate button).
        attributionControl: false,
        // Satellite imagery is 256 px raster; rendering above 1.5× only multiplies
        // GPU/CPU work (2.6× DPR phones paint ~3× the pixels) without visible gain.
        pixelRatio: Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO),
        dragRotate: true,
        maxPitch: 0,
      });
      mapRef.current = map;
      map.addControl(new AttributionControl({ compact: true }), "bottom-left");
      // Only the ⓘ shows; its text opens on click. MapLibre opens it by itself the
      // first time the imagery credits arrive, so that one opening is undone.
      const attribution = containerRef.current.querySelector(".maplibregl-ctrl-attrib");
      if (attribution) {
        const collapse = new MutationObserver(() => {
          if (!attribution.classList.contains("maplibregl-compact-show")) return;
          attribution.classList.remove("maplibregl-compact-show");
          attribution.removeAttribute("open");
          collapse.disconnect();
        });
        collapse.observe(attribution, { attributes: true, attributeFilter: ["class"] });
      }

      map.on("error", (event: ErrorEvent) => {
        console.error("[atlas-globe]", event.error?.message ?? event);
      });

      map.on("load", () => {
        readyRef.current = true;
        setReady(true);
      });

      map.on("styleimagemissing", (event: { id: string }) => {
        const soft = event.id === TOPIC_BADGE_IMAGES.inherited;
        if ((!soft && event.id !== TOPIC_BADGE_IMAGES.own) || map.hasImage(event.id)) return;
        const badge = topicBadgeImage(soft);
        if (badge) map.addImage(event.id, badge.image, badge.options);
      });

      // State for e2e tests and diagnostics: country borders are loaded and rendered.
      // "idle" isn't enough — it may not fire during camera animation; sourcedata always does.
      const markCountriesLoaded = (event: MapSourceDataEvent) => {
        if (event.sourceId !== "countries" || !map.isSourceLoaded("countries")) return;
        containerRef.current?.setAttribute("data-countries", "loaded");
        map.off("sourcedata", markCountriesLoaded);
      };
      map.on("sourcedata", markCountriesLoaded);

      /** The active metric's value for a country (none in the default view). */
      const metricFor = (iso3: string): HoverLabel["metric"] => {
        const metric = metricValuesRef.current[viewRef.current];
        if (!metric) return undefined;
        const entry = metric.values[iso3];
        return { label: metric.label, value: entry?.[0] ?? null, year: entry?.[1] };
      };

      /** What's under the cursor: country ISO3, its name and the target URL per mode. */
      const targetAt = (point: MapMouseEvent["point"]) => {
        const feature = map.queryRenderedFeatures(point, {
          layers: [LAYERS.fill],
        })[0];
        const iso3 = (feature?.properties?.iso3 as string | undefined) ?? null;
        if (!iso3) return null;

        // Group modes: a click opens the whole group, not a single country.
        if (modeRef.current === "regions" || modeRef.current === "issue") {
          const isIssue = modeRef.current === "issue";
          const lookup = isIssue ? issueRef.current : regionsRef.current;
          const slug = lookup.slugByCountry[iso3];
          const group = slug ? lookup.bySlug[slug] : undefined;
          if (!group) return null;
          const topics = topicCountsRef.current[isIssue ? "issue" : "regions"][slug ?? ""] ?? 0;
          return {
            iso3,
            label: {
              name: group.name,
              topics: topics ? topicLabelRef.current(topics) : undefined,
            } as HoverLabel,
            href: isIssue ? `/global-issue/${slug}` : `/region/${slug}`,
            countries: group.countries,
          };
        }

        const slug = slugsRef.current[iso3];
        if (!slug) return null;
        const name = (feature?.properties?.name as string) ?? iso3;
        const topics = topicCountsRef.current.countries[iso3] ?? 0;
        return {
          iso3,
          label: {
            name,
            metric: metricFor(iso3),
            topics: topics ? topicLabelRef.current(topics) : undefined,
          } as HoverLabel,
          href: `/country/${slug}`,
          countries: [iso3],
        };
      };

      /** Recomputes the highlight for the given point on the canvas. */
      const applyHover = (point: MapMouseEvent["point"] | null) => {
        const target = point ? targetAt(point) : null;
        // The metric is part of the key, so switching it under a still cursor updates the label.
        const key = target ? `${target.href}|${viewRef.current}` : null;
        if (key === hoveredRef.current) return;
        hoveredRef.current = key;

        // Highlighted countries are kept in feature-state. It's just a flag on already
        // loaded geometry, so the map doesn't re-tessellate anything and doesn't flicker.
        setHoverState(map, hoveredIsoRef, target ? target.countries : []);

        setHoverLabel(target?.label ?? null);
        map.getCanvas().style.cursor = target ? "pointer" : "grab";

        // Fetch the panel content already on hover, so the click is instant.
        if (target && !prefetchedRef.current.has(target.href)) {
          prefetchedRef.current.add(target.href);
          router.prefetch(target.href);
        }
      };

      const onMove = (event: MapMouseEvent) => {
        cursorRef.current = event.point;
        applyHover(event.point);
      };

      const onClick = (event: MapMouseEvent) => {
        const target = targetAt(event.point);
        if (!target) return;
        setPending({ iso3: target.iso3, since: activeRef.current });
        router.push(target.href);
      };

      // During a camera flight different countries pass under a still cursor.
      // So we turn the highlight off when movement starts and recompute it when it ends,
      // otherwise a random country from mid-animation would stay highlighted.
      // The idle spin moves the camera every frame; the highlight stays on until the cursor moves.
      const onMoveStart = (event: object) => {
        if (isSpinEvent(event)) return;
        hoveredRef.current = null;
        setHoverState(map, hoveredIsoRef, []);
        setHoverLabel(null);
      };
      const onMoveEnd = (event: object) => {
        if (!isSpinEvent(event)) applyHover(cursorRef.current);
      };

      map.on("mousemove", onMove);
      map.on("click", onClick);
      map.on("movestart", onMoveStart);
      map.on("moveend", onMoveEnd);
      map.on("mouseout", () => applyHover(null));

      cleanup = () => {
        map.remove();
        mapRef.current = null;
        readyRef.current = false;
      };
    });
    return () => {
      cancelled = true;
      cleanup?.();
    };
    // The map is deliberately not recreated – dependencies are read via ref/router.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- coloring by the selected layer ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const colors =
      mode === "issue" && view === "encyclopedia"
        ? (colorSets.issue ?? {})
        : (colorSets[view] ?? colorSets.encyclopedia ?? {});
    map.setPaintProperty(LAYERS.fill, "fill-color", matchExpression(colors));

    const isData = view !== "encyclopedia";
    map.setPaintProperty(LAYERS.fill, "fill-opacity", isData ? 0.88 : 0.55);

    // Data layers want legible fills, the encyclopedia wants to see the terrain.
    map.setPaintProperty(LAYERS.satellite, "raster-opacity", isData ? 0.28 : 1);
    map.setPaintProperty(LAYERS.satellite, "raster-saturation", isData ? -0.6 : -0.35);
    map.setPaintProperty(
      LAYERS.border,
      "line-color",
      isData ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.4)",
    );
  }, [colorSets, view, mode, ready]);

  // --- selection mode: countries vs. regions ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const isGrouped = mode !== "countries";

    // In regions mode internal borders and country names recede into the background,
    // so the colored groups read as regions.
    map.setPaintProperty(LAYERS.border, "line-opacity", isGrouped ? 0.25 : 1);
    map.setLayoutProperty(LAYERS.label, "visibility", isGrouped ? "none" : "visible");
    map.setLayoutProperty(
      LAYERS.regionLabel,
      "visibility",
      mode === "regions" ? "visible" : "none",
    );

    // Switching mode cancels any pending highlight under the cursor.
    setHoverState(map, hoveredIsoRef, []);
    hoveredRef.current = null;
    setHoverLabel(null);
  }, [mode, ready]);

  // --- topic counts: one badge layer per mode, numbers from the server ---
  const openIssue = /^\/global-issue\/([^/]+)/.exec(
    splitLocale(withoutDefaultPrefix(pathname)).path,
  )?.[1];
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
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
      map.setLayoutProperty(layer, "text-field", text);
      // The small globe window on full-width pages shows no counts.
      map.setLayoutProperty(layer, "visibility", key === mode && !mini ? "visible" : "none");
      // Solid pill for topics of the place's own, soft one when all are
      // inherited; a zero is soft and faint.
      const own: ExpressionSpecification =
        key === "countries" ? ["in", ["get", "iso3"], ["literal", ownTopicCountries]] : has;
      map.setLayoutProperty(layer, "icon-image", [
        "case",
        own,
        TOPIC_BADGE_IMAGES.own,
        TOPIC_BADGE_IMAGES.inherited,
      ]);
      map.setPaintProperty(layer, "text-color", ["case", own, "#0b1220", "#ffffff"]);
      map.setPaintProperty(layer, "icon-opacity", ["case", has, 0.92, 0.5]);
      map.setPaintProperty(layer, "text-opacity", ["case", has, 1, 0.7]);
    }
  }, [topicCounts, ownTopicCountries, mode, openIssue, mini, ready]);

  // --- highlight of the active country / region ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    // pendingIso3 holds the highlight right after a click, until the new page arrives.
    const active = focus.activeIso3 ?? pendingIso3;
    applyFeatureState(map, activeIsoRef, active ? [active] : [], "active");
    applyFeatureState(map, regionIsoRef, focus.regionCountries, "inRegion");

    if (focus.regionStroke) {
      map.setPaintProperty(LAYERS.regionOutline, "line-color", focus.regionStroke);
    }
  }, [focus.activeIso3, focus.regionCountries, focus.regionStroke, pendingIso3, ready]);

  // --- camera flight ---
  /** The last place a page focused on (country label, region centre) – where closing a panel zooms out. */
  const lastPlaceRef = useRef<[number, number] | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (focus.center) lastPlaceRef.current = focus.center;

    // Corner window: the whole globe, turned to the page's place (if it has one).
    if (mini) {
      const zoom = miniGlobeZoom(window.innerWidth);
      map.setMinZoom(Math.min(MIN_ZOOM, zoom));
      map.easeTo({
        center: focus.center ?? map.getCenter(),
        zoom,
        duration: WINDOW_MS,
        essential: true,
      });
      return;
    }
    // Back to the full map: grow the globe with the window, then restore the usual minimum.
    if (map.getMinZoom() < MIN_ZOOM) {
      map.once("moveend", () => map.setMinZoom(MIN_ZOOM));
      if (!focus.bbox && !focus.center) {
        map.easeTo({ zoom: globeFillZoom(), duration: WINDOW_MS, essential: true });
        return;
      }
    }

    // The viewport can zoom "by country size": Luxembourg up close, Russia from afar.
    if (focus.bbox) {
      const [minLon, minLat, maxLon, maxLat] = focus.bbox;
      map.fitBounds(
        [
          [minLon, minLat],
          [maxLon, maxLat],
        ],
        {
          // The content panel is on the right, so we shift the country to the left part of the map.
          padding: railPadding(),
          maxZoom: 6,
          duration: 1600,
          essential: true,
        },
      );
      return;
    }

    // Zoom only (closing a panel): zoom out over the last place instead of turning the globe away.
    if (!focus.center && focus.zoom === null) return;
    map.flyTo({
      center: focus.center ?? lastPlaceRef.current ?? map.getCenter(),
      zoom: focus.zoom ?? 3,
      duration: 1600,
      essential: true,
    });
  }, [focus.bbox, focus.center, focus.zoom, mini, ready]);

  return (
    <div
      ref={surfaceRef}
      data-print="hide"
      data-globe-window={mini ? "" : undefined}
      // Width/height animate between the full map and the corner window; MapLibre
      // follows the size with its ResizeObserver, a final resize() makes it crisp.
      onTransitionEnd={(event) => {
        if (event.target === event.currentTarget) mapRef.current?.resize();
      }}
      className={cn(
        "fixed bottom-0 left-0 overflow-hidden bg-[var(--color-space-deep)] transition-[width,height,left,bottom,border-radius] duration-700 ease-[cubic-bezier(0.65,0,0.35,1)]",
        mini
          ? // On phones the window would cover the text; "Back to Atlas" is in the header.
            "bottom-4 left-4 z-[46] h-(--mini-globe-height) w-(--mini-globe-width) rounded-2xl shadow-2xl ring-1 shadow-black/60 ring-white/25 max-sm:hidden"
          : "h-dvh w-full",
      )}
    >
      <div ref={containerRef} className="h-full w-full" />

      {mini ? (
        <Link
          href="/"
          aria-label={t.topics.globeWindow}
          className="group absolute inset-0 z-10 flex items-start justify-center rounded-2xl bg-gradient-to-b from-black/55 via-transparent to-transparent p-2.5 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none focus-visible:ring-inset"
        >
          <span className="rounded-full bg-black/55 px-3.5 py-[5px] text-[13px] font-medium text-white backdrop-blur transition group-hover:bg-black/75">
            {t.topics.backToAtlas}
          </span>
        </Link>
      ) : null}

      <div
        hidden={mini}
        // Phones zoom with two fingers: the buttons would only crowd the controls there.
        className="pointer-events-none absolute top-24 left-5 hidden flex-col gap-1.5 md:flex"
      >
        <button
          type="button"
          aria-label={t.map.zoomIn}
          onClick={() => mapRef.current?.zoomIn({ duration: 300 })}
          className="glass glass-hover pointer-events-auto flex size-(--touch-min) items-center justify-center rounded-[10px] text-white/90 transition focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <Plus size={18} aria-hidden />
        </button>
        <button
          type="button"
          aria-label={t.map.zoomOut}
          onClick={() => mapRef.current?.zoomOut({ duration: 300 })}
          className="glass glass-hover pointer-events-auto flex size-(--touch-min) items-center justify-center rounded-[10px] text-white/90 transition focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <Minus size={18} aria-hidden />
        </button>
      </div>

      {hoverLabel && !mini ? (
        <div className="glass pointer-events-none absolute bottom-6 left-1/2 w-max max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-3xl px-5 py-[9px] text-center text-[15px] tracking-wide text-white/90 sm:text-[18px]">
          <span className="font-semibold text-white">{hoverLabel.name}</span>
          {hoverLabel.metric ? (
            <>
              <span className="text-white/45"> · </span>
              {hoverLabel.metric.label}:{" "}
              <span className="font-semibold text-white tabular-nums">
                {hoverLabel.metric.value ?? t.map.noData}
              </span>
              {hoverLabel.metric.year ? (
                <span className="text-white/55"> ({hoverLabel.metric.year})</span>
              ) : null}
            </>
          ) : null}
          {hoverLabel.topics ? (
            <>
              <span className="text-white/45"> · </span>
              {hoverLabel.topics}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
