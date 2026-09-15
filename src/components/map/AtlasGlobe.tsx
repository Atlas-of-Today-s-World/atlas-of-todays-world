"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import maplibregl, { type Map as MapLibreMap, type MapMouseEvent } from "maplibre-gl";
import { buildStyle, LAYERS } from "./mapStyle";
import { EUROPE_CENTER, globeFillZoom } from "@/lib/home-location";
import { useMapState } from "./MapContext";

export interface GlobeColorSets {
  /** ISO3 -> barva pro každou vrstvu, předpočítané na serveru. */
  [view: string]: Record<string, string>;
}

export interface RegionLookup {
  /** ISO3 -> slug regionu. */
  slugByCountry: Record<string, string>;
  /** slug regionu -> jeho země a název. */
  bySlug: Record<string, { name: string; countries: string[] }>;
}

interface Props {
  colorSets: GlobeColorSets;
  /** ISO3 -> slug země, pro navigaci po kliknutí. */
  slugs: Record<string, string>;
  regions: RegionLookup;
}

const NEUTRAL = "#7d8aa8";

/**
 * Odsazení výřezu tak, aby zemi nezakryl pravý panel s obsahem.
 * Šířka panelu je stejná jako v ContentRail (min(38vw, 27rem)).
 */
function railPadding() {
  if (typeof window === "undefined") return 60;
  const isDesktop = window.innerWidth >= 768;
  const rail = isDesktop ? Math.min(window.innerWidth * 0.38, 432) : 0;
  return {
    top: 110,
    bottom: isDesktop ? 90 : window.innerHeight * 0.5,
    left: 60,
    right: rail + 40,
  };
}

type StateKey = "hover" | "inRegion" | "active";

/**
 * Přepne feature-state u zadaných zemí a zhasne ty předchozí.
 * Ref si drží, co právě svítí, aby se sahalo jen na rozdíl.
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

const setHoverState = (
  map: MapLibreMap,
  ref: { current: string[] },
  next: string[],
) => applyFeatureState(map, ref, next, "hover");

/** Z mapy ISO3->barva udělá MapLibre `match` výraz. */
function matchExpression(colors: Record<string, string>): unknown[] {
  const stops: unknown[] = [];
  for (const [iso3, color] of Object.entries(colors)) stops.push(iso3, color);
  if (!stops.length) return ["literal", NEUTRAL] as unknown[];
  return ["match", ["get", "iso3"], ...stops, NEUTRAL];
}

export default function AtlasGlobe({ colorSets, slugs, regions }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const hoveredRef = useRef<string | null>(null);
  const readyRef = useRef(false);
  const router = useRouter();
  const { focus, view, mode } = useMapState();
  const [hoverLabel, setHoverLabel] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  /** Země, na kterou se právě kliklo – zvýrazníme ji dřív, než dorazí obsah. */
  const [pendingIso3, setPendingIso3] = useState<string | null>(null);

  // Obsluha myši se mění s režimem, ale mapu kvůli tomu nevytváříme znovu.
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const regionsRef = useRef(regions);
  regionsRef.current = regions;
  const slugsRef = useRef(slugs);
  slugsRef.current = slugs;
  /** URL, které už jsme předstáhli – ať neprefetchujeme totéž při každém pohybu. */
  const prefetchedRef = useRef(new Set<string>());
  /** Poslední pozice kurzoru nad mapou, pro přepočet po dojezdu kamery. */
  const cursorRef = useRef<MapMouseEvent["point"] | null>(null);
  // Co právě svítí ve feature-state, ať se při změně sahá jen na rozdíl.
  const hoveredIsoRef = useRef<string[]>([]);
  const regionIsoRef = useRef<string[]>([]);
  const activeIsoRef = useRef<string[]>([]);

  // --- inicializace mapy (jen jednou za celý život aplikace) ---
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildStyle(),
      // První snímek rovnou ve výchozí vzdálenosti, ať se mapa nezobrazí
      // nejdřív jako malá kulička a teprve pak nepřiletí.
      center: EUROPE_CENTER,
      zoom: globeFillZoom(),
      minZoom: 0.8,
      maxZoom: 9,
      attributionControl: { compact: true },
      dragRotate: true,
      maxPitch: 0,
    });
    mapRef.current = map;
    // Ladicí úchyt: v konzoli prohlížeče je mapa dostupná jako window.atlasMap.
    (window as unknown as { atlasMap?: MapLibreMap }).atlasMap = map;

    map.on("error", (event) => {
      console.error("[atlas-globe]", event.error?.message ?? event);
    });

    map.on("load", () => {
      readyRef.current = true;
      setReady(true);
    });

    /** Co je pod kurzorem: ISO3 země, její název a cílová URL podle režimu. */
    const targetAt = (point: MapMouseEvent["point"]) => {
      const feature = map.queryRenderedFeatures(point, {
        layers: [LAYERS.fill],
      })[0];
      const iso3 = (feature?.properties?.iso3 as string | undefined) ?? null;
      if (!iso3) return null;

      if (modeRef.current === "regions") {
        const regionSlug = regionsRef.current.slugByCountry[iso3];
        const region = regionSlug
          ? regionsRef.current.bySlug[regionSlug]
          : undefined;
        if (!region) return null;
        return {
          iso3,
          label: region.name,
          href: `/region/${regionSlug}`,
          countries: region.countries,
        };
      }

      const slug = slugsRef.current[iso3];
      if (!slug) return null;
      return {
        iso3,
        label: (feature?.properties?.name as string) ?? iso3,
        href: `/country/${slug}`,
        countries: [iso3],
      };
    };

    /** Přepočítá zvýraznění pro daný bod na plátně. */
    const applyHover = (point: MapMouseEvent["point"] | null) => {
      const target = point ? targetAt(point) : null;
      const key = target?.href ?? null;
      if (key === hoveredRef.current) return;
      hoveredRef.current = key;

      // Zvýrazněné země držíme ve feature-state. Je to jen příznak na už
      // nahrané geometrii, takže mapa nic nepřetesává a nebliká.
      setHoverState(map, hoveredIsoRef, target ? target.countries : []);

      setHoverLabel(target?.label ?? null);
      map.getCanvas().style.cursor = target ? "pointer" : "grab";

      // Obsah panelu stáhneme už při najetí, ať je klik okamžitý.
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
      setPendingIso3(target.iso3);
      router.push(target.href);
    };

    // Během přeletu kamery se pod nehybným kurzorem vystřídají různé země.
    // Zvýraznění proto na začátku pohybu zhasneme a po dojezdu přepočítáme,
    // jinak by na mapě zůstala viset náhodná země z půlky animace.
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

    return () => {
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
    // Mapa se schválně nevytváří znovu – závislosti čte přes ref/router.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- obarvení podle zvolené vrstvy ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const colors = colorSets[view] ?? colorSets.encyclopedia ?? {};
    map.setPaintProperty(LAYERS.fill, "fill-color", matchExpression(colors));

    const isData = view !== "encyclopedia";
    map.setPaintProperty(LAYERS.fill, "fill-opacity", isData ? 0.88 : 0.55);

    // Datové vrstvy chtějí čitelné plochy, encyklopedie chce vidět terén.
    map.setPaintProperty(LAYERS.satellite, "raster-opacity", isData ? 0.28 : 1);
    map.setPaintProperty(LAYERS.satellite, "raster-saturation", isData ? -0.6 : -0.35);
    map.setPaintProperty(
      LAYERS.border,
      "line-color",
      isData ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.4)",
    );
  }, [colorSets, view, ready]);

  // --- režim výběru: státy vs. regiony ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const isRegions = mode === "regions";

    // V režimu regionů ustoupí vnitřní hranice a názvy států do pozadí,
    // aby barevné celky četly jako regiony.
    map.setPaintProperty(
      LAYERS.border,
      "line-opacity",
      isRegions ? 0.25 : 1,
    );
    map.setLayoutProperty(
      LAYERS.label,
      "visibility",
      isRegions ? "none" : "visible",
    );
    map.setLayoutProperty(
      LAYERS.regionLabel,
      "visibility",
      isRegions ? "visible" : "none",
    );

    // Přepnutí režimu ruší rozpracované zvýraznění pod kurzorem.
    setHoverState(map, hoveredIsoRef, []);
    hoveredRef.current = null;
    setHoverLabel(null);
  }, [mode, ready]);

  // --- zvýraznění aktivní země / regionu ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    // pendingIso3 drží zvýraznění hned po kliknutí, než dorazí nová stránka.
    const active = focus.activeIso3 ?? pendingIso3;
    applyFeatureState(map, activeIsoRef, active ? [active] : [], "active");
    applyFeatureState(map, regionIsoRef, focus.regionCountries, "inRegion");

    if (focus.regionStroke) {
      map.setPaintProperty(LAYERS.regionOutline, "line-color", focus.regionStroke);
    }
  }, [
    focus.activeIso3,
    focus.regionCountries,
    focus.regionStroke,
    pendingIso3,
    ready,
  ]);

  // Jakmile dorazí obsah, převezme zvýraznění stránka a dočasné zmizí.
  useEffect(() => {
    if (focus.activeIso3) setPendingIso3(null);
  }, [focus.activeIso3]);

  // --- přelet kamery ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    // Výřez umí zoomovat "podle velikosti země": Lucembursko zblízka, Rusko z dálky.
    if (focus.bbox) {
      const [minLon, minLat, maxLon, maxLat] = focus.bbox;
      map.fitBounds(
        [
          [minLon, minLat],
          [maxLon, maxLat],
        ],
        {
          // Vpravo je panel s obsahem, takže zemi posuneme do levé části mapy.
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
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full" />

      <div className="pointer-events-none absolute left-5 top-24 flex flex-col gap-1.5">
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => mapRef.current?.zoomIn({ duration: 300 })}
          className="glass glass-hover pointer-events-auto flex h-9 w-9 items-center justify-center rounded-[10px] text-lg leading-none text-white/90 transition"
        >
          +
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => mapRef.current?.zoomOut({ duration: 300 })}
          className="glass glass-hover pointer-events-auto flex h-9 w-9 items-center justify-center rounded-[10px] text-lg leading-none text-white/90 transition"
        >
          −
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
