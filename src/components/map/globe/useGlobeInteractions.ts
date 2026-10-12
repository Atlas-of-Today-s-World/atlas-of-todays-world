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
import type { SelectionModeKey } from "./topicBadges";
import type { RegionLookup } from "./types";

/**
 * Hover, click and prefetch on the globe. `bind(map)` attaches the handlers
 * once, right after the map is created; they read everything through refs, so
 * the map is never recreated when the mode, the data or the language change.
 * Returns the label under the cursor and the place just clicked (`pendingIso3`,
 * highlighted until the page for it takes over the active country).
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
  /** The country just clicked – we highlight it before the content arrives. */
  // Valid until the active country changes (since) — then the page takes over.
  const [pending, setPending] = useState<{ iso3: string; since: string | null } | null>(null);
  const pendingIso3 = pending && pending.since === activeIso3 ? pending.iso3 : null;

  const hoveredRef = useRef<string | null>(null);
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

  /** Turns off the highlight and label under the cursor. */
  const clearHover = useCallback((map: MapLibreMap) => {
    hoveredRef.current = null;
    setHoverState(map, hoveredIsoRef, []);
    setHoverLabel(null);
  }, []);

  const bind = (map: MapLibreMap) => {
    /** The active metric's value for a country (none in the default view). */
    const metricFor = (iso3: string): HoverLabel["metric"] => {
      const metric = layersRef.current[viewRef.current];
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
          } as HoverLabel,
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
        } as HoverLabel,
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
      if (!isSpinEvent(event)) clearHover(map);
    };
    const onMoveEnd = (event: object) => {
      if (!isSpinEvent(event)) applyHover(cursorRef.current);
    };

    map.on("mousemove", onMove);
    map.on("click", onClick);
    map.on("movestart", onMoveStart);
    map.on("moveend", onMoveEnd);
    map.on("mouseout", () => applyHover(null));
  };

  return { hoverLabel, pendingIso3, bind, clearHover };
}
