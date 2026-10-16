"use client";

import type { GlobeLayer } from "@/features/geography/globe-layer";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { Map as MapLibreMap, ErrorEvent, MapSourceDataEvent } from "maplibre-gl";
import { foldAttribution } from "./attribution";
import { loadMapLibre } from "./maplibre";
import { transformGlyphRequest } from "./glyphs";
import {
  buildStyle,
  LAYERS,
  TOPIC_BADGE_IMAGES,
  type RegionLabel,
  type StyleOptions,
} from "./mapStyle";
import { apiFetch } from "@/lib/api-fetch";
import { EUROPE_CENTER, globeFillZoom } from "@/lib/home-location";
import { useMapState } from "./MapContext";
import { useLatest } from "@/lib/use-latest";
import {
  DESKTOP_MIN_PX,
  GLOBE,
  GLOBE_LABEL_MOBILE,
  isFullPage,
  isHome,
  railKind,
} from "@/config/layout";
import { cn } from "@/lib/cn";
import { useIdleSpin } from "./useIdleSpin";
import { useZeroPulse } from "./globe/zeroPulse";
import { Starfield } from "./Starfield";
import { type ContentStatus, unprocessedCountries } from "@/features/geography/content-status";
import { openIssueSlug, STATUS_IMAGES, statusesOf, statusMarkImage } from "./global-issues";
import { applyFeatureState } from "./globe/featureState";
import { paintLayer, paintSelectionMode } from "./globe/layerPaint";
import {
  applyTopicBadges,
  pulseTopicBadges,
  topicBadgeImage,
  type SelectionModeKey,
} from "./globe/topicBadges";
import type { GlobeColorSets, RegionLookup } from "./globe/types";
import { initialCamera, useGlobeCamera } from "./globe/useGlobeCamera";
import { scheduleGlobeStart, type GlobeStartGate } from "./globe/startGate";
import { GlobeWake } from "./globe/GlobeWake";
import { useGlobeInteractions } from "./globe/useGlobeInteractions";
import { GlobeHoverLabel } from "./globe/GlobeHoverLabel";
import { GlobePlaceholder } from "./globe/GlobePlaceholder";
import { GlobeUnavailable } from "./globe/GlobeUnavailable";
import { GlobeZoomControls } from "./globe/GlobeZoomControls";
import { MiniGlobeLink } from "./globe/MiniGlobeLink";
import { isTouchScreen, TOUCH_MAP_OPTIONS, touchStyle } from "./globe/touch";

export type { RegionLookup } from "./globe/types";

interface Props {
  /** The always-on layers (regions, special regions); metric layers load on demand. */
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
  /** ISO3 → "ready" for countries whose own content (a timeline) is created; the rest aren't yet. */
  countryStatuses: Record<string, ContentStatus>;
}

/** Upper bound for the globe canvas pixel ratio (see the Map options). */
const MAX_PIXEL_RATIO = 1.5;

/**
 * The globe behind every map page, created once for the app's whole lifetime.
 * This component orchestrates: it creates the map, keeps its paint in step with
 * the map state, and lays out the views over it. Camera, interactions, badges
 * and paint live in ./globe/.
 */
export default function AtlasGlobe({
  colorSets,
  slugs,
  regions,
  issue,
  regionLabels,
  styleOptions,
  topicCounts,
  countryStatuses,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const { focus, view, mode } = useMapState();
  const [ready, setReady] = useState(false);
  // Country borders are on the globe: the placeholder sphere may go ("load" can
  // come much later, after every satellite tile).
  const [painted, setPainted] = useState(false);
  // MapLibre failed to load or the browser has no WebGL: a message replaces the globe.
  const [failed, setFailed] = useState(false);
  // A phone with a panel open: the globe waits for the visitor (globe/startGate).
  const [waiting, setWaiting] = useState(false);
  // It did wait: the placeholder sphere held its place meanwhile and fades out once painted.
  const [waited, setWaited] = useState(false);
  // The map opened straight at the page's place (initialCamera), not over Europe.
  const [openedAtPlace, setOpenedAtPlace] = useState(false);
  const gateRef = useRef<GlobeStartGate | null>(null);
  // Metric layers (colours + hover values) fetched the first time each is switched on.
  const [layers, setLayers] = useState<Record<string, GlobeLayer>>({});
  // Read by the idle spin's pulse, which is created once.
  const modeRef = useLatest(mode);
  const topicCountsRef = useLatest(topicCounts);
  // What's currently lit in feature-state, so changes only touch the difference.
  const regionIsoRef = useRef<string[]>([]);
  const activeIsoRef = useRef<string[]>([]);

  const pathname = usePathname();
  /** Full-width page (Topics, entry): the globe waits in a small window bottom left. */
  const mini = isFullPage(pathname);
  /** A content panel is open (on phones the bottom sheet covers most of the globe). */
  const panelOpen = railKind(pathname) !== "none";
  // Read when the map is created and by the start gate, both outside React's render.
  const panelOpenRef = useLatest(panelOpen);
  const focusRef = useLatest(focus);
  const homeRef = useLatest(isHome(pathname));
  const miniRef = useLatest(mini);
  /** The global issue whose panel is open: its countries are lit, the rest of the world greys out. */
  const openIssue = openIssueSlug(pathname);
  // Content status per group (marks in the pills) and the countries of regions
  // nobody has started on (grey in Regions mode). Issues keep their colours: one
  // spanning the whole world (Migration) would otherwise grey the entire globe.
  const statuses = useMemo(
    () => ({
      countries: countryStatuses,
      regions: statusesOf(regions.bySlug),
      issue: statusesOf(issue.bySlug),
    }),
    [countryStatuses, regions, issue],
  );
  const unprocessed = useMemo(() => unprocessedCountries(Object.values(regions.bySlug)), [regions]);

  const { hoverLabel, previewHref, openPreview, pendingIso3, bind, clearHover } =
    useGlobeInteractions({
      mode,
      regions,
      issue,
      slugs,
      topicCounts,
      countryStatuses,
      layers,
      view,
      openIssue,
      activeIso3: focus.activeIso3,
    });

  // On the home map (and in the corner window) the globe turns slowly until the user grabs it,
  // and now and then two topic counts pulse to invite a click.
  const noPanel = !panelOpen;
  const spin = useIdleSpin(mapRef, surfaceRef, ready, noPanel, () => {
    const map = mapRef.current;
    if (!map || document.hidden) return;
    const key = modeRef.current;
    pulseTopicBadges(map, key, (place) => topicCountsRef.current[key][place] ?? 0);
  });

  // --- map initialization (only once for the app's whole lifetime) ---
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const container = containerRef.current;
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    // MapLibre and its worker from public/ (loadMapLibre, ADR-017).
    const init = () =>
      loadMapLibre().then(async ({ Map: MapLibreMap, AttributionControl }) => {
        // Evaluating the library is one long task; creating the map is another.
        // A turn of the event loop between them lets a tap or a frame through.
        await new Promise((resolve) => setTimeout(resolve, 0));
        if (cancelled || !containerRef.current) return;
        const touch = isTouchScreen();
        const style = buildStyle(regionLabels, styleOptions);
        // A country or region page: open right at its place (the home flies to the visitor's).
        const atPlace = homeRef.current || miniRef.current ? {} : initialCamera(focusRef.current);
        setOpenedAtPlace(Object.keys(atPlace).length > 0);
        const map = new MapLibreMap({
          container: containerRef.current,
          style: touch ? touchStyle(style) : style,
          // Label glyphs we don't host come from their original source (glyphs.ts).
          transformRequest: transformGlyphRequest,
          // Phones and tablets: no fades, a smaller tile cache (globe/touch.ts).
          ...(touch ? TOUCH_MAP_OPTIONS : {}),
          // First frame straight at the default distance, so the map doesn't first
          // appear as a tiny ball and only then fly in.
          center: EUROPE_CENTER,
          zoom: globeFillZoom(),
          ...atPlace,
          minZoom: GLOBE.minZoom,
          maxZoom: GLOBE.maxZoom,
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
        // Only the ⓘ shows; its text opens on click.
        foldAttribution(containerRef.current);

        map.on("error", (event: ErrorEvent) => {
          console.error("[atlas-globe]", event.error?.message ?? event);
        });

        map.on("load", () => {
          // Status marks inside the topic pills (check mark, hourglass) go in before any
          // pill names them: an image inside text isn't laid out again once it arrives.
          for (const id of Object.values(STATUS_IMAGES)) {
            const mark = statusMarkImage(id);
            if (mark && !map.hasImage(id)) map.addImage(id, mark.image, mark.options);
          }
          setReady(true);
        });

        map.on("styleimagemissing", (event: { id: string }) => {
          const variant = (
            Object.keys(TOPIC_BADGE_IMAGES) as (keyof typeof TOPIC_BADGE_IMAGES)[]
          ).find((key) => TOPIC_BADGE_IMAGES[key] === event.id);
          if (!variant || map.hasImage(event.id)) return;
          const badge = topicBadgeImage(variant);
          if (badge) map.addImage(event.id, badge.image, badge.options);
        });

        // State for e2e tests and diagnostics: country borders are loaded and rendered.
        // "idle" isn't enough — it may not fire during camera animation; sourcedata always does.
        const markCountriesLoaded = (event: MapSourceDataEvent) => {
          if (event.sourceId !== "countries" || !map.isSourceLoaded("countries")) return;
          containerRef.current?.setAttribute("data-countries", "loaded");
          setPainted(true);
          map.off("sourcedata", markCountriesLoaded);
        };
        map.on("sourcedata", markCountriesLoaded);

        // Hover, click and prefetch (globe/useGlobeInteractions).
        bind(map);

        cleanup = () => {
          map.remove();
          mapRef.current = null;
        };
      });
    // The library didn't load, or `new MapLibreMap` threw (no WebGL): a message
    // with the way to the country list replaces the globe.
    const start = () =>
      void init().catch((error: unknown) => {
        if (cancelled) return;
        console.error("[atlas-globe]", error instanceof Error ? error.message : error);
        setFailed(true);
      });

    // The globe waits for its turn (globe/startGate): the page loaded, an idle
    // moment, on a phone with a panel open the visitor's first tap on the map, a size.
    const gate = scheduleGlobeStart({
      container,
      deferred: () => panelOpenRef.current && window.innerWidth < DESKTOP_MIN_PX,
      onWaiting: (value) => {
        if (cancelled) return;
        setWaiting(value);
        if (value) setWaited(true);
      },
      start,
    });
    gateRef.current = gate;
    return () => {
      cancelled = true;
      gate.cancel();
      gateRef.current = null;
      cleanup?.();
    };
    // The map is deliberately not recreated – dependencies are read via refs (also in bind).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The panel closed (or a page without one opened): a waiting globe starts.
  useEffect(() => {
    if (!panelOpen) gateRef.current?.release();
  }, [panelOpen]);

  // --- a metric layer, loaded when it is first switched on ---
  useEffect(() => {
    if (view === "encyclopedia" || colorSets[view] || layers[view]) return;
    const controller = new AbortController();
    apiFetch<GlobeLayer | null>(`/api/globe-layer/${encodeURIComponent(view)}`, {
      signal: controller.signal,
    })
      .then((layer) => {
        if (layer) setLayers((loaded) => ({ ...loaded, [view]: layer }));
      })
      // Offline or a removed layer: the globe keeps its current colours.
      .catch(() => {});
    return () => controller.abort();
  }, [view, colorSets, layers]);

  // --- coloring by the selected layer ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    paintLayer(map, {
      colorSets,
      metricColors: layers[view]?.colors,
      view,
      mode,
      openIssue,
      issue,
      unprocessed,
    });
  }, [colorSets, layers, view, mode, openIssue, issue, unprocessed, ready]);

  // --- selection mode: countries vs. regions ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    paintSelectionMode(map, mode);
    // Switching mode cancels any pending highlight under the cursor.
    clearHover(map);
  }, [mode, ready, clearHover]);

  // --- topic counts: one badge layer per mode, numbers from the server ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    applyTopicBadges(map, { topicCounts, statuses, mode, openIssue, mini });
  }, [topicCounts, statuses, mode, openIssue, mini, ready]);

  // Every 0 on countries and regions pulses red: places waiting for their first topic.
  useZeroPulse(mapRef, ready && !mini && mode !== "issue");

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
  useGlobeCamera(mapRef, ready, focus, mini, openedAtPlace);

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
            // Below 3xl a round button, so it never covers the column (globals.css).
            "z-mini-globe bottom-4 left-4 h-(--mini-globe-height) w-(--mini-globe-width) rounded-(--mini-globe-radius) shadow-2xl ring-1 shadow-black/60 ring-white/25 max-sm:hidden"
          : "h-dvh w-full",
      )}
    >
      <Starfield />
      <div ref={containerRef} className="h-full w-full" />
      {(isHome(pathname) || waited) && !mini && !failed ? (
        <GlobePlaceholder faded={painted || ready} />
      ) : null}
      {waiting ? <GlobeWake onWake={() => gateRef.current?.release()} /> : null}
      <GlobeUnavailable show={failed && !mini} />
      {mini ? <MiniGlobeLink /> : null}
      <GlobeZoomControls
        hidden={mini || failed}
        onZoomIn={() => mapRef.current?.zoomIn({ duration: GLOBE.zoomStepMs })}
        onZoomOut={() => mapRef.current?.zoomOut({ duration: GLOBE.zoomStepMs })}
        spin={spin}
      />
      {hoverLabel && !mini ? (
        <GlobeHoverLabel
          label={hoverLabel}
          href={previewHref}
          onOpen={openPreview}
          className={noPanel ? GLOBE_LABEL_MOBILE.map : GLOBE_LABEL_MOBILE.sheet}
        />
      ) : null}
    </div>
  );
}
