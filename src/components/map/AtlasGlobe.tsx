"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import maplibregl, { type Map as MapLibreMap, type MapMouseEvent } from "maplibre-gl";
import { buildStyle, LAYERS } from "./mapStyle";
import { useMapState } from "./MapContext";

export interface GlobeColorSets {
  /** ISO3 -> barva pro každou vrstvu, předpočítané na serveru. */
  [view: string]: Record<string, string>;
}

interface Props {
  colorSets: GlobeColorSets;
  /** ISO3 -> slug země, pro navigaci po kliknutí. */
  slugs: Record<string, string>;
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

/** Z mapy ISO3->barva udělá MapLibre `match` výraz. */
function matchExpression(colors: Record<string, string>): unknown[] {
  const stops: unknown[] = [];
  for (const [iso3, color] of Object.entries(colors)) stops.push(iso3, color);
  if (!stops.length) return ["literal", NEUTRAL] as unknown[];
  return ["match", ["get", "iso3"], ...stops, NEUTRAL];
}

export default function AtlasGlobe({ colorSets, slugs }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const hoveredRef = useRef<string | null>(null);
  const readyRef = useRef(false);
  const router = useRouter();
  const { focus, view } = useMapState();
  const [hoverLabel, setHoverLabel] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // --- inicializace mapy (jen jednou za celý život aplikace) ---
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildStyle(),
      center: [18, 30],
      zoom: 1.6,
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

    const onMove = (event: MapMouseEvent) => {
      const features = map.queryRenderedFeatures(event.point, {
        layers: [LAYERS.fill],
      });
      const iso3 = (features[0]?.properties?.iso3 as string | undefined) ?? null;
      if (iso3 === hoveredRef.current) return;

      if (hoveredRef.current) {
        map.setFeatureState(
          { source: "countries", id: hoveredRef.current },
          { hover: false },
        );
      }
      hoveredRef.current = iso3;
      if (iso3) {
        map.setFeatureState({ source: "countries", id: iso3 }, { hover: true });
      }
      setHoverLabel(
        iso3 ? ((features[0]?.properties?.name as string) ?? null) : null,
      );
      map.getCanvas().style.cursor = iso3 && slugs[iso3] ? "pointer" : "grab";
    };

    const onClick = (event: MapMouseEvent) => {
      const features = map.queryRenderedFeatures(event.point, {
        layers: [LAYERS.fill],
      });
      const iso3 = features[0]?.properties?.iso3 as string | undefined;
      const slug = iso3 ? slugs[iso3] : undefined;
      if (slug) router.push(`/country/${slug}`);
    };

    map.on("mousemove", onMove);
    map.on("click", onClick);

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
    map.setPaintProperty(LAYERS.fill, "fill-opacity", [
      "case",
      ["boolean", ["feature-state", "hover"], false],
      isData ? 0.95 : 0.78,
      isData ? 0.88 : 0.55,
    ]);

    // Datové vrstvy chtějí čitelné plochy, encyklopedie chce vidět terén.
    map.setPaintProperty(LAYERS.satellite, "raster-opacity", isData ? 0.28 : 1);
    map.setPaintProperty(LAYERS.satellite, "raster-saturation", isData ? -0.6 : -0.35);
    map.setPaintProperty(
      LAYERS.border,
      "line-color",
      isData ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.4)",
    );
  }, [colorSets, view, ready]);

  // --- zvýraznění aktivní země / regionu ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    map.setFilter(LAYERS.activeOutline, [
      "==",
      ["get", "iso3"],
      focus.activeIso3 ?? "___none___",
    ]);

    map.setFilter(
      LAYERS.regionOutline,
      focus.regionCountries.length
        ? ["in", ["get", "iso3"], ["literal", focus.regionCountries]]
        : ["==", ["get", "iso3"], "___none___"],
    );
    if (focus.regionStroke) {
      map.setPaintProperty(LAYERS.regionOutline, "line-color", focus.regionStroke);
    }
  }, [focus.activeIso3, focus.regionCountries, focus.regionStroke, ready]);

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
