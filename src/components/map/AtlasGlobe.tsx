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
import { DESKTOP_MIN_PX, GLOBE, isFullPage, isHome, railKind } from "@/config/layout";
import { cn } from "@/lib/cn";
import { useIdleSpin } from "./useIdleSpin";
import { Starfield } from "./Starfield";
import type { RegionProgress } from "@/features/geography/content-status";
import {
  openIssueSlug,
  PILL_MARKS,
  pillMarkImage,
  STATUS_IMAGES,
  statusesOf,
  statusMarkImage,
} from "./global-issues";
import { applyFeatureState } from "./globe/featureState";
import { paintLayer, paintSelectionMode } from "./globe/layerPaint";
import {
  applyTopicBadges,
  pulseTopicBadges,
  syncLabelZoom,
  topicBadgeImage,
  type SelectionModeKey,
} from "./globe/topicBadges";
import type { GlobeColorSets, RegionLookup } from "./globe/types";
import { initialCamera, useGlobeCamera } from "./globe/useGlobeCamera";
import { scheduleGlobeStart, type GlobeStartGate } from "./globe/startGate";
import { GlobeWake } from "./globe/GlobeWake";
import { useGlobeInteractions } from "./globe/useGlobeInteractions";
import { GlobePlaceholder } from "./globe/GlobePlaceholder";
import { GlobeUnavailable } from "./globe/GlobeUnavailable";
import { GlobeZoomControls } from "./globe/GlobeZoomControls";
import { drawsInSoftware, LOW_POWER_PIXEL_RATIO } from "./globe/lowPower";
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
  /** A region's whole entry plan (published and planned topics), per region and per country. */
  topicTotals: Record<Exclude<SelectionModeKey, "issue">, Record<string, number>>;
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
  topicTotals,
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
  const topicTotalsRef = useLatest(topicTotals);
  // What's currently lit in feature-state, so changes only touch the difference.
  const regionIsoRef = useRef<string[]>([]);
  const activeIsoRef = useRef<string[]>([]);

  const pathname = usePathname();
  /** Full-width page (Topics, entry): the globe waits in a small window bottom left. */
  const mini = isFullPage(pathname);
  // A phone-sized window: the smaller countries' pills come a zoom later (topicBadges).
  const [phone, setPhone] = useState(false);
  /** WebGL drawn by the CPU (globe/lowPower): the globe moves only when asked to. */
  const [lowPower, setLowPower] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${DESKTOP_MIN_PX - 0.02}px)`);
    const sync = () => setPhone(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  const phoneRef = useLatest(phone);
  /** A content panel is open (on phones the bottom sheet covers most of the globe). */
  const panelOpen = railKind(pathname) !== "none";
  // Read when the map is created and by the start gate, both outside React's render.
  const panelOpenRef = useLatest(panelOpen);
  const focusRef = useLatest(focus);
  const homeRef = useLatest(isHome(pathname));
  const miniRef = useLatest(mini);
  /** The global issue whose panel is open: its countries are lit, the rest of the world greys out. */
  const openIssue = openIssueSlug(pathname);
  // Content status per place (marks and colours of the pills: a country carries
  // its region's progress) and the countries of planned regions (grey in Regions
  // mode). Issues keep their colours: one spanning the whole world (Migration)
  // would otherwise grey the entire globe.
  const statuses = useMemo(
    () => ({
      countries: Object.fromEntries(
        Object.entries(regions.slugByCountry).map(([iso3, slug]) => [
          iso3,
          regions.bySlug[slug]?.status ?? "planned",
        ]),
      ),
      regions: statusesOf(regions.bySlug),
      issue: statusesOf(issue.bySlug),
    }),
    [regions, issue],
  );
  const statusesRef = useLatest(statuses);

  const { pendingIso3, bind, clearHover } = useGlobeInteractions({
    mode,
    regions,
    issue,
    slugs,
    openIssue,
    activeIso3: focus.activeIso3,
  });

  // On the home map (and in the corner window) the globe turns slowly until the user grabs it,
  // and now and then two topic counts pulse to invite a click.
  const noPanel = !panelOpen;
  const spin = useIdleSpin(
    mapRef,
    surfaceRef,
    ready,
    noPanel,
    () => {
      const map = mapRef.current;
      if (!map || document.hidden) return;
      const key = modeRef.current;
      pulseTopicBadges(
        map,
        key,
        (place) => {
          const done = topicCountsRef.current[key][place] ?? 0;
          if (key === "issue") return String(done);
          return `${done}/${Math.max(topicTotalsRef.current[key][place] ?? 0, done)}`;
        },
        (place) =>
          key === "issue" ? undefined : (statusesRef.current[key][place] as RegionProgress),
        phoneRef.current,
      );
    },
    !lowPower,
  );

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
        // Drawn in software: every frame is CPU work, so fewer pixels and no idle motion.
        if (drawsInSoftware(map.getCanvas())) {
          map.setPixelRatio(LOW_POWER_PIXEL_RATIO);
          setLowPower(true);
        }
        map.addControl(new AttributionControl({ compact: true }), "bottom-left");
        // Only the ⓘ shows; its text opens on click.
        foldAttribution(containerRef.current);

        map.on("error", (event: ErrorEvent) => {
          console.error("[atlas-globe]", event.error?.message ?? event);
        });

        map.on("load", () => {
          // Status marks inside the topic pills (check mark, hourglass, calendar) go in before any
          // pill names them: an image inside text isn't laid out again once it arrives.
          for (const id of Object.values(STATUS_IMAGES)) {
            const mark = statusMarkImage(id);
            if (mark && !map.hasImage(id)) map.addImage(id, mark.image, mark.options);
          }
          for (const id of Object.values(PILL_MARKS)) {
            const mark = pillMarkImage(id);
            if (mark && !map.hasImage(id)) map.addImage(id, mark.image, mark.options);
          }
          // So do the pills: one requested later by a feature already laid out stays missing.
          for (const id of Object.values(TOPIC_BADGE_IMAGES)) {
            const badge = topicBadgeImage(id);
            if (badge && !map.hasImage(id)) map.addImage(id, badge.image, badge.options);
          }
          // Names and pills by the zoom the view would have over Europe (mapStyle LABEL_ZOOM_STATE).
          syncLabelZoom(map);
          map.on("move", () => syncLabelZoom(map));
          setReady(true);
        });

        map.on("styleimagemissing", (event: { id: string }) => {
          const known = Object.values(TOPIC_BADGE_IMAGES) as string[];
          if (!known.includes(event.id) || map.hasImage(event.id)) return;
          const badge = topicBadgeImage(event.id);
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
    });
  }, [colorSets, layers, view, mode, openIssue, issue, ready]);

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
    applyTopicBadges(map, { topicCounts, topicTotals, statuses, mode, openIssue, mini, phone });
  }, [topicCounts, topicTotals, statuses, mode, openIssue, mini, phone, ready]);

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
    </div>
  );
}
