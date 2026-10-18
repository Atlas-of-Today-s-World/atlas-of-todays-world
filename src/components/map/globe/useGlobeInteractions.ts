"use client";

import { useCallback, useRef, useState } from "react";
import type { Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";
import { useLocalizedRouter } from "@/components/i18n/useLocalizedRouter";
import { routes } from "@/config/routes";
import { useLatest } from "@/lib/use-latest";
import type { SelectionMode } from "../MapContext";
import { LAYERS } from "../mapStyle";
import { isSpinEvent } from "../useIdleSpin";
import { setHoverState } from "./featureState";
import { doubleClickZooms, isTouchPointer } from "./touch";
import type { RegionLookup } from "./types";

/** A place on the globe: where a click leads. */
interface Target {
  iso3: string;
  href: string;
  /** Countries lit with it (the whole group in group modes). */
  countries: string[];
}

/**
 * Hover, click and prefetch on the globe. `bind(map)` attaches the handlers
 * once, right after the map is created; they read everything through refs, so
 * the map is never recreated when the mode, the data or the language change.
 * Returns the place just clicked (`pendingIso3`, highlighted until the page for
 * it takes over the active country).
 *
 * A finger has no hover: on touch a tap opens the place at once, like a click,
 * and a double tap doesn't zoom the globe (it would throw off the flight to the
 * place just opened). Mouse and keyboard are unchanged.
 */
export function useGlobeInteractions({
  mode,
  regions,
  issue,
  slugs,
  openIssue,
  activeIso3,
}: {
  mode: SelectionMode;
  regions: RegionLookup;
  issue: RegionLookup;
  slugs: Record<string, string>;
  openIssue: string | undefined;
  activeIso3: string | null;
}) {
  const router = useLocalizedRouter();
  /** The country just clicked – we highlight it before the content arrives. */
  // Valid until the active country changes (since) — then the page takes over.
  const [pending, setPending] = useState<{ iso3: string; since: string | null } | null>(null);
  const pendingIso3 = pending && pending.since === activeIso3 ? pending.iso3 : null;

  const hoveredRef = useRef<string | null>(null);
  /** The pointer last used on the globe ("touch", "mouse", "pen"): a finger has no hover. */
  const pointerRef = useRef<string | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  // Mouse handling changes with the mode, but we don't recreate the map for that.
  const modeRef = useLatest(mode);
  const regionsRef = useLatest(regions);
  const issueRef = useLatest(issue);
  const slugsRef = useLatest(slugs);
  const openIssueRef = useLatest(openIssue);
  const activeRef = useLatest(activeIso3);
  /** URLs we've already prefetched – so we don't prefetch the same on every move. */
  const prefetchedRef = useRef(new Set<string>());
  /** Last cursor position over the map, for recomputing after the camera settles. */
  const cursorRef = useRef<MapMouseEvent["point"] | null>(null);
  // The countries lit under the cursor, so changes only touch the difference.
  const hoveredIsoRef = useRef<string[]>([]);

  /** Turns off the highlight under the cursor. */
  const clearHover = useCallback((map: MapLibreMap) => {
    hoveredRef.current = null;
    setHoverState(map, hoveredIsoRef, []);
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

  const bind = (map: MapLibreMap) => {
    mapRef.current = map;

    /** What's under the cursor: country ISO3 and the target URL per mode. */
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
        return {
          iso3,
          href: isIssue ? routes.issue(slug) : routes.region(slug),
          countries: group.countries,
        };
      }

      const slug = slugsRef.current[iso3];
      if (!slug) return null;
      return {
        iso3,
        href: routes.country(slug),
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

      map.getCanvas().style.cursor = target ? "pointer" : "grab";

      // Fetch the panel content already on hover, so the click is instant.
      if (target) prefetch(target.href);
    };

    // Which pointer is in use. Pointer events carry their type; the mouse events a
    // browser fakes after a tap (mousemove, mouseout, click) can't be trusted to, so
    // they are judged by the pointer that came before them. Captured on the
    // container, so nothing inside the map can swallow it.
    // A finger's tap opens a place and the globe flies to it, so a double tap must
    // not also zoom the globe; the switch is made on the first tap's pointerdown, long before
    // the second tap ends (MapLibre zooms on that touchend, or on the dblclick after it).
    const notePointer = (event: PointerEvent) => {
      pointerRef.current = event.pointerType;
      const zoom = map.doubleClickZoom;
      const zooms = doubleClickZooms(event.pointerType);
      if (zooms === zoom.isEnabled()) return;
      if (zooms) zoom.enable();
      else zoom.disable();
    };
    const container = map.getContainer();
    container.addEventListener("pointerdown", notePointer, { capture: true, passive: true });
    container.addEventListener("pointermove", notePointer, { capture: true, passive: true });
    const touch = () => isTouchPointer(pointerRef.current);

    const onMove = (event: MapMouseEvent) => {
      // A tap's fake mousemove would light the place before the tap itself decides.
      if (touch()) return;
      cursorRef.current = event.point;
      applyHover(event.point);
    };

    const onClick = (event: MapMouseEvent) => {
      const target = targetAt(event.point);
      // A finger leaves no hover behind; the pending highlight marks the place being opened.
      if (touch()) clearHover(map);
      if (!target) return;
      markPending(target);
      router.push(target.href);
    };

    // During a camera flight different countries pass under a still cursor.
    // So we turn the highlight off when movement starts and recompute it when it ends,
    // otherwise a random country from mid-animation would stay highlighted.
    // The idle spin moves the camera every frame; the highlight stays on until the cursor moves.
    // On touch there is no cursor to come back to.
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

  return { pendingIso3, bind, clearHover };
}
