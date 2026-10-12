"use client";

import { useCallback, useRef, useState } from "react";
import type { Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";
import type { GlobeLayer } from "@/features/geography/globe-layer";
import type { ContentStatus } from "@/features/geography/content-status";
import { format } from "@/features/i18n/messages";
import { useLocalizedRouter } from "@/components/i18n/useLocalizedRouter";
import { useMessages } from "@/components/i18n/LocaleProvider";
import { routes } from "@/config/routes";
import { useLatest } from "@/lib/use-latest";
import type { SelectionMode } from "../MapContext";
import { LAYERS } from "../mapStyle";
import { isSpinEvent } from "../useIdleSpin";
import { setHoverState } from "./featureState";
import type { HoverLabel } from "./GlobeHoverLabel";
import { isTouchPointer, tapStep } from "./tapPreview";
import type { SelectionModeKey } from "./topicBadges";
import type { RegionLookup } from "./types";

/** A place on the globe: what its label says and where a click leads. */
interface Target {
  iso3: string;
  label: HoverLabel;
  href: string;
  /** Countries lit with it (the whole group in group modes). */
  countries: string[];
}

/**
 * Hover, click and prefetch on the globe. `bind(map)` attaches the handlers
 * once, right after the map is created; they read everything through refs, so
 * the map is never recreated when the mode, the data or the language change.
 * Returns the label under the cursor and the place just clicked (`pendingIso3`,
 * highlighted until the page for it takes over the active country).
 *
 * A finger has no hover: on touch the first tap previews a place (highlight and
 * label, with `previewHref` set so the label becomes a link), a second tap on it
 * or on the label opens it (globe/tapPreview). Mouse and keyboard are unchanged.
 */
export function useGlobeInteractions({
  mode,
  regions,
  issue,
  slugs,
  topicCounts,
  layers,
  view,
  openIssue,
  activeIso3,
}: {
  mode: SelectionMode;
  regions: RegionLookup;
  issue: RegionLookup;
  slugs: Record<string, string>;
  topicCounts: Record<SelectionModeKey, Record<string, number>>;
  layers: Record<string, GlobeLayer>;
  view: string;
  openIssue: string | undefined;
  activeIso3: string | null;
}) {
  const t = useMessages();
  const router = useLocalizedRouter();
  const [hoverLabel, setHoverLabel] = useState<HoverLabel | null>(null);
  /** Touch only: where the previewed place leads (its label is then a link). */
  const [previewHref, setPreviewHref] = useState<string | null>(null);
  /** The country just clicked – we highlight it before the content arrives. */
  // Valid until the active country changes (since) — then the page takes over.
  const [pending, setPending] = useState<{ iso3: string; since: string | null } | null>(null);
  const pendingIso3 = pending && pending.since === activeIso3 ? pending.iso3 : null;

  const hoveredRef = useRef<string | null>(null);
  /** The place picked by a first tap, for the handlers (previewHref mirrors it for render). */
  const previewRef = useRef<Target | null>(null);
  /** The pointer last used on the globe ("touch", "mouse", "pen"): a finger previews first. */
  const pointerRef = useRef<string | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  // Mouse handling changes with the mode, but we don't recreate the map for that.
  const modeRef = useLatest(mode);
  const regionsRef = useLatest(regions);
  const issueRef = useLatest(issue);
  const slugsRef = useLatest(slugs);
  const topicCountsRef = useLatest(topicCounts);
  const layersRef = useLatest(layers);
  const viewRef = useLatest(view);
  const openIssueRef = useLatest(openIssue);
  const activeRef = useLatest(activeIso3);
  const topicLabelRef = useLatest((count: number) =>
    count === 1 ? t.map.topicsOne : format(t.map.topicsCount, { count: String(count) }),
  );
  const statusLabelRef = useLatest(
    (status: ContentStatus) =>
      ({ ready: t.map.statusReady, preparing: t.map.statusPreparing, none: t.map.statusNone })[
        status
      ],
  );
  /** URLs we've already prefetched – so we don't prefetch the same on every move. */
  const prefetchedRef = useRef(new Set<string>());
  /** Last cursor position over the map, for recomputing after the camera settles. */
  const cursorRef = useRef<MapMouseEvent["point"] | null>(null);
  // The countries lit under the cursor, so changes only touch the difference.
  const hoveredIsoRef = useRef<string[]>([]);

  /** Turns off the highlight and label under the cursor (and a touch preview). */
  const clearHover = useCallback((map: MapLibreMap) => {
    hoveredRef.current = null;
    previewRef.current = null;
    setHoverState(map, hoveredIsoRef, []);
    setHoverLabel(null);
    setPreviewHref(null);
  }, []);

  /** Fetches a place's panel ahead, so opening it is instant. */
  const prefetch = (href: string) => {
    if (prefetchedRef.current.has(href)) return;
    prefetchedRef.current.add(href);
    router.prefetch(href);
  };

  /** Highlights the place being opened until its page takes over the active country. */
  const markPending = (target: Target) =>
    setPending({ iso3: target.iso3, since: activeRef.current });

  /** The previewed place's label was tapped: its link navigates, the globe marks the place. */
  const openPreview = () => {
    const target = previewRef.current;
    if (!target) return;
    markPending(target);
    if (mapRef.current) clearHover(mapRef.current);
  };

  const bind = (map: MapLibreMap) => {
    mapRef.current = map;

    /** The active metric's value for a country (none in the default view). */
    const metricFor = (iso3: string): HoverLabel["metric"] => {
      const metric = layersRef.current[viewRef.current];
      if (!metric) return undefined;
      const entry = metric.values[iso3];
      return { label: metric.label, value: entry?.[0] ?? null, year: entry?.[1] };
    };

    /** What's under the cursor: country ISO3, its name and the target URL per mode. */
    const targetAt = (point: MapMouseEvent["point"]): Target | null => {
      const feature = map.queryRenderedFeatures(point, {
        layers: [LAYERS.fill],
      })[0];
      const iso3 = (feature?.properties?.iso3 as string | undefined) ?? null;
      if (!iso3) return null;

      // Group modes: a click opens the whole group, not a single country.
      if (modeRef.current === "regions" || modeRef.current === "issue") {
        const isIssue = modeRef.current === "issue";
        const lookup = isIssue ? issueRef.current : regionsRef.current;
        // A country can be in several issues: over the open one's members it stays that issue.
        const open = isIssue ? openIssueRef.current : undefined;
        const slug =
          open && lookup.bySlug[open]?.countries.includes(iso3) ? open : lookup.slugByCountry[iso3];
        const group = slug ? lookup.bySlug[slug] : undefined;
        if (!slug || !group) return null;
        const topics = topicCountsRef.current[isIssue ? "issue" : "regions"][slug] ?? 0;
        return {
          iso3,
          label: {
            name: group.name,
            topics: topics ? topicLabelRef.current(topics) : undefined,
            status: statusLabelRef.current(group.status),
          },
          href: isIssue ? routes.issue(slug) : routes.region(slug),
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
        },
        href: routes.country(slug),
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
      if (target) prefetch(target.href);
    };

    /** Touch: lights the tapped place and turns its label into a link (null clears it). */
    const showPreview = (target: Target | null) => {
      previewRef.current = target;
      // A mouse used later recomputes its hover from scratch.
      hoveredRef.current = null;
      setHoverState(map, hoveredIsoRef, target ? target.countries : []);
      setHoverLabel(target?.label ?? null);
      setPreviewHref(target?.href ?? null);
      if (target) prefetch(target.href);
    };

    // Which pointer is in use. Pointer events carry their type; the mouse events a
    // browser fakes after a tap (mousemove, mouseout, click) can't be trusted to, so
    // they are judged by the pointer that came before them. Captured on the
    // container, so nothing inside the map can swallow it.
    const notePointer = (event: PointerEvent) => {
      pointerRef.current = event.pointerType;
    };
    const container = map.getContainer();
    container.addEventListener("pointerdown", notePointer, { capture: true, passive: true });
    container.addEventListener("pointermove", notePointer, { capture: true, passive: true });
    const touch = () => isTouchPointer(pointerRef.current);

    const onMove = (event: MapMouseEvent) => {
      // A tap's fake mousemove would light the place before the tap itself decides.
      if (touch()) return;
      // The mouse is back after a touch preview: plain hover takes over.
      if (previewRef.current) clearHover(map);
      cursorRef.current = event.point;
      applyHover(event.point);
    };

    const onClick = (event: MapMouseEvent) => {
      const target = targetAt(event.point);
      if (touch()) {
        const step = tapStep(previewRef.current?.href ?? null, target?.href ?? null);
        if (step !== "open") return showPreview(step === "preview" ? target : null);
        showPreview(null);
      }
      if (!target) return;
      markPending(target);
      router.push(target.href);
    };

    // During a camera flight different countries pass under a still cursor.
    // So we turn the highlight off when movement starts and recompute it when it ends,
    // otherwise a random country from mid-animation would stay highlighted.
    // The idle spin moves the camera every frame; the highlight stays on until the cursor moves.
    // On touch there is no cursor to come back to: a drag or a flight drops the preview.
    const onMoveStart = (event: object) => {
      if (!isSpinEvent(event)) clearHover(map);
    };
    const onMoveEnd = (event: object) => {
      if (!isSpinEvent(event) && !touch()) applyHover(cursorRef.current);
    };

    map.on("mousemove", onMove);
    map.on("click", onClick);
    map.on("movestart", onMoveStart);
    map.on("moveend", onMoveEnd);
    map.on("mouseout", () => {
      if (!touch()) applyHover(null);
    });
  };

  return { hoverLabel, previewHref, openPreview, pendingIso3, bind, clearHover };
}
