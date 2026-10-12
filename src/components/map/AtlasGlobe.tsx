"use client";

import type { GlobeLayer } from "@/features/geography/globe-layer";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { Map as MapLibreMap, ErrorEvent, MapSourceDataEvent } from "maplibre-gl";
import { loadMapLibre } from "./maplibre";
import {
  buildStyle,
  LAYERS,
  TOPIC_BADGE_IMAGES,
  type RegionLabel,
  type StyleOptions,
} from "./mapStyle";
import { EUROPE_CENTER, globeFillZoom } from "@/lib/home-location";
import { useMapState } from "./MapContext";
import { useLatest } from "@/lib/use-latest";
import { GLOBE, isFullPage, isHome, railKind } from "@/config/layout";
import { cn } from "@/lib/cn";
import { useIdleSpin } from "./useIdleSpin";
import { Starfield } from "./Starfield";
import { unprocessedCountries } from "@/features/geography/content-status";
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
import { useGlobeCamera } from "./globe/useGlobeCamera";
import { useGlobeInteractions } from "./globe/useGlobeInteractions";
import { GlobeHoverLabel } from "./globe/GlobeHoverLabel";
import { GlobePlaceholder } from "./globe/GlobePlaceholder";
import { GlobeUnavailable } from "./globe/GlobeUnavailable";
import { GlobeZoomControls } from "./globe/GlobeZoomControls";
import { MiniGlobeLink } from "./globe/MiniGlobeLink";

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
}

/** Longest wait for an idle moment before the globe starts anyway. */
const GLOBE_START_TIMEOUT_MS = 1500;
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
  /** The global issue whose panel is open: its countries are lit, the rest of the world greys out. */
  const openIssue = openIssueSlug(pathname);
  // Content status per group (marks in the pills) and the countries of regions
  // nobody has started on (grey in Regions mode). Issues keep their colours: one
  // spanning the whole world (Migration) would otherwise grey the entire globe.
  const statuses = useMemo(
    () => ({ regions: statusesOf(regions.bySlug), issue: statusesOf(issue.bySlug) }),
    [regions, issue],
  );
  const unprocessed = useMemo(() => unprocessedCountries(Object.values(regions.bySlug)), [regions]);

  const { hoverLabel, pendingIso3, bind, clearHover } = useGlobeInteractions({
    mode,
    regions,
    issue,
    slugs,
    topicCounts,
    layers,
    view,
    openIssue,
    activeIso3: focus.activeIso3,
  });

  // On the home map (and in the corner window) the globe turns slowly until the user grabs it,
  // and now and then two topic counts pulse to invite a click.
  const spin = useIdleSpin(mapRef, surfaceRef, ready, railKind(pathname) === "none", () => {
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
      loadMapLibre().then(({ Map: MapLibreMap, AttributionControl }) => {
        if (cancelled || !containerRef.current) return;
        const map = new MapLibreMap({
          container: containerRef.current,
          style: buildStyle(regionLabels, styleOptions),
          // First frame straight at the default distance, so the map doesn't first
          // appear as a tiny ball and only then fly in.
          center: EUROPE_CENTER,
          zoom: globeFillZoom(),
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
          // Status marks inside the topic pills (check mark, hourglass) go in before any
          // pill names them: an image inside text isn't laid out again once it arrives.
          for (const id of Object.values(STATUS_IMAGES)) {
            const mark = statusMarkImage(id);
            if (mark && !map.hasImage(id)) map.addImage(id, mark.image, mark.options);
          }
          setReady(true);
        });

        map.on("styleimagemissing", (event: { id: string }) => {
          const soft = event.id === TOPIC_BADGE_IMAGES.none;
          if ((!soft && event.id !== TOPIC_BADGE_IMAGES.some) || map.hasImage(event.id)) return;
          const badge = topicBadgeImage(soft);
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

    // The globe waits for its turn: once the browser is idle (the page's text is
    // painted first — on phones its ~300 kB library and first frames would push
    // the Largest Contentful Paint back by seconds), and never while it is hidden
    // (the corner window is left out on phones): it starts once it has a size.
    let observer: ResizeObserver | undefined;
    const whenVisible = () => {
      if (cancelled) return;
      const sized = () => container.clientWidth > 0 && container.clientHeight > 0;
      if (sized()) return start();
      observer = new ResizeObserver(() => {
        if (!sized()) return;
        observer?.disconnect();
        start();
      });
      observer.observe(container);
    };
    const idle =
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback(whenVisible, { timeout: GLOBE_START_TIMEOUT_MS })
        : window.setTimeout(whenVisible, 1);
    return () => {
      cancelled = true;
      if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      observer?.disconnect();
      cleanup?.();
    };
    // The map is deliberately not recreated – dependencies are read via refs (also in bind).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- a metric layer, loaded when it is first switched on ---
  useEffect(() => {
    if (view === "encyclopedia" || colorSets[view] || layers[view]) return;
    const controller = new AbortController();
    fetch(`/api/globe-layer/${encodeURIComponent(view)}`, { signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<GlobeLayer>) : null))
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
  useGlobeCamera(mapRef, ready, focus, mini);

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
      <Starfield />
      <div ref={containerRef} className="h-full w-full" />
      {isHome(pathname) && !mini && !failed ? <GlobePlaceholder faded={painted || ready} /> : null}
      <GlobeUnavailable show={failed && !mini} />
      {mini ? <MiniGlobeLink /> : null}
      <GlobeZoomControls
        hidden={mini || failed}
        onZoomIn={() => mapRef.current?.zoomIn({ duration: GLOBE.zoomStepMs })}
        onZoomOut={() => mapRef.current?.zoomOut({ duration: GLOBE.zoomStepMs })}
        spin={spin}
      />
      {hoverLabel && !mini ? <GlobeHoverLabel label={hoverLabel} /> : null}
    </div>
  );
}
