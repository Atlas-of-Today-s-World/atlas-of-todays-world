"use client";

import { useEffect, useRef, useState } from "react";
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
  TOPIC_BADGE_IMAGE,
  TOPIC_LAYERS,
  type RegionLabel,
  type StyleOptions,
} from "./mapStyle";
import { format } from "@/features/i18n/messages";
import { EUROPE_CENTER, globeFillZoom } from "@/lib/home-location";
import { useMapState } from "./MapContext";
import { useLatest } from "@/lib/use-latest";
import { DESKTOP_MIN_PX, railKind, railWidthPx } from "@/config/layout";
import { useMessages } from "@/components/i18n/LocaleProvider";

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

interface Props {
  colorSets: GlobeColorSets;
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
}

type SelectionModeKey = keyof typeof TOPIC_LAYERS;

/** The pill behind a topic count: white, rounded, stretchable around the number. */
function topicBadgeImage() {
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

/** ISO3 / slug → count as MapLibre filter and label expressions for one badge layer. */
function topicExpressions(counts: Record<string, number>, property: "iso3" | "slug") {
  const keys = Object.keys(counts);
  const pairs = keys.flatMap((key) => [key, String(counts[key])]);
  const has: ExpressionSpecification = ["in", ["get", property], ["literal", keys]];
  // MapLibre types can't express a variable number of pairs in "match".
  const text = (keys.length
    ? ["match", ["get", property], ...pairs, ""]
    : ["literal", ""]) as unknown as ExpressionSpecification;
  return { has, text };
}

const NEUTRAL = "#7d8aa8";
/** Upper bound for the globe canvas pixel ratio (see the Map options). */
const MAX_PIXEL_RATIO = 1.5;

/**
 * Viewport padding so the right content panel doesn't cover the country — wide
 * or narrow, depending on the path being navigated to (tokens from config/layout.ts).
 */
function railPadding() {
  if (typeof window === "undefined") return 60;
  const isDesktop = window.innerWidth >= DESKTOP_MIN_PX;
  const rail = railWidthPx(railKind(window.location.pathname), window.innerWidth);
  return {
    top: 110,
    bottom: isDesktop ? 90 : window.innerHeight * 0.5,
    left: 60,
    right: rail + 40,
  };
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
  slugs,
  regions,
  issue,
  regionLabels,
  styleOptions,
  topicCounts,
}: Props) {
  const t = useMessages();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const hoveredRef = useRef<string | null>(null);
  const readyRef = useRef(false);
  const router = useLocalizedRouter();
  const { focus, view, mode } = useMapState();
  const [hoverLabel, setHoverLabel] = useState<string | null>(null);
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

  // --- map initialization (only once for the app's whole lifetime) ---
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;
    // MapLibre i jeho worker z public/ (loadMapLibre, ADR-017).
    void loadMapLibre().then(({ Map: MapLibreMap }) => {
      if (cancelled || !containerRef.current) return;
      const map = new MapLibreMap({
        container: containerRef.current,
        style: buildStyle(regionLabels, styleOptions),
        // First frame straight at the default distance, so the map doesn't first
        // appear as a tiny ball and only then fly in.
        center: EUROPE_CENTER,
        zoom: globeFillZoom(),
        minZoom: 0.8,
        maxZoom: 9,
        attributionControl: { compact: true },
        // Satellite imagery is 256 px raster; rendering above 1.5× only multiplies
        // GPU/CPU work (2.6× DPR phones paint ~3× the pixels) without visible gain.
        pixelRatio: Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO),
        dragRotate: true,
        maxPitch: 0,
      });
      mapRef.current = map;

      map.on("error", (event: ErrorEvent) => {
        console.error("[atlas-globe]", event.error?.message ?? event);
      });

      map.on("load", () => {
        readyRef.current = true;
        setReady(true);
      });

      map.on("styleimagemissing", (event: { id: string }) => {
        if (event.id !== TOPIC_BADGE_IMAGE || map.hasImage(TOPIC_BADGE_IMAGE)) return;
        const badge = topicBadgeImage();
        if (badge) map.addImage(TOPIC_BADGE_IMAGE, badge.image, badge.options);
      });

      // State for e2e tests and diagnostics: country borders are loaded and rendered.
      // "idle" isn't enough — it may not fire during camera animation; sourcedata always does.
      const markCountriesLoaded = (event: MapSourceDataEvent) => {
        if (event.sourceId !== "countries" || !map.isSourceLoaded("countries")) return;
        containerRef.current?.setAttribute("data-countries", "loaded");
        map.off("sourcedata", markCountriesLoaded);
      };
      map.on("sourcedata", markCountriesLoaded);

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
            label: topics ? `${group.name} · ${topicLabelRef.current(topics)}` : group.name,
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
          label: topics ? `${name} · ${topicLabelRef.current(topics)}` : name,
          href: `/country/${slug}`,
          countries: [iso3],
        };
      };

      /** Recomputes the highlight for the given point on the canvas. */
      const applyHover = (point: MapMouseEvent["point"] | null) => {
        const target = point ? targetAt(point) : null;
        const key = target?.href ?? null;
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
      const onMoveStart = () => {
        hoveredRef.current = null;
        setHoverState(map, hoveredIsoRef, []);
        setHoverLabel(null);
      };
      const onMoveEnd = () => applyHover(cursorRef.current);

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
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const layers: [SelectionModeKey, "iso3" | "slug"][] = [
      ["countries", "iso3"],
      ["regions", "slug"],
      ["issue", "slug"],
    ];
    for (const [key, property] of layers) {
      const { has, text } = topicExpressions(topicCounts[key], property);
      const layer = TOPIC_LAYERS[key];
      map.setFilter(
        layer,
        key === "countries"
          ? (["all", COUNTRY_RANK_FILTER, has] as unknown as ExpressionSpecification)
          : has,
      );
      map.setLayoutProperty(layer, "text-field", text);
      map.setLayoutProperty(layer, "visibility", key === mode ? "visible" : "none");
    }
  }, [topicCounts, mode, ready]);

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
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

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

    if (!focus.center) return;
    map.flyTo({
      center: focus.center,
      zoom: focus.zoom ?? 3,
      duration: 1600,
      essential: true,
    });
  }, [focus.bbox, focus.center, focus.zoom, ready]);

  return (
    <div data-print="hide" className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full" />

      <div className="pointer-events-none absolute top-24 left-5 flex flex-col gap-1.5">
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

      {hoverLabel ? (
        <div className="glass pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full px-3.5 py-1.5 text-xs tracking-wide text-white/90">
          {hoverLabel}
        </div>
      ) : null}
    </div>
  );
}
