"use client";

import type { Map as MapLibreMap } from "maplibre-gl";
import { MousePointerClick, Undo2 } from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CountryGroups } from "@/components/admin/CountryPicker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/field";
import { TabPanel, Tabs } from "@/components/ui/tabs";
import {
  addPoint,
  emptyHistory,
  frameCamera,
  recordEdit,
  specBytes,
  toggleHighlight,
  undo,
  untitledPoints,
  updatePoint,
  withFraming,
  type History,
} from "../builder-state";
import { pointPosition } from "../geo";
import { emptyMapSpec, MAP_LIMITS, type MapBounds, type MapSpec, type MapView } from "../types";
import { CountriesPanel } from "./builder/CountriesPanel";
import type { Edit } from "./builder/fields";
import { LegendPanel } from "./builder/LegendPanel";
import { PointsPanel } from "./builder/PointsPanel";
import { ViewPanel } from "./builder/ViewPanel";
import { ViewStatus } from "./builder/ViewStatus";
import { MapFrame } from "./MapVisual";

type Tab = "view" | "countries" | "points" | "legend";

const TABS: { id: Tab; label: string }[] = [
  { id: "view", label: "View" },
  { id: "countries", label: "Countries" },
  { id: "points", label: "Points" },
  { id: "legend", label: "Legend" },
];

const TABS_ID = "map-builder";

/**
 * The admin's custom map editor: the map on the left — the very renderer
 * readers get, with dragging and clicking added — and the settings on the
 * right in four tabs. Every change goes to `onChange` as a whole new spec
 * (the caller validates it with `parseMapSpec` when saving); Undo steps back
 * through the last 50 changes.
 *
 * The view: in a free view the map's current view is the framing — pan and
 * zoom, save, and readers get exactly that. With countries or a region framed,
 * moving the map only looks around until "Use this view". Above the map the
 * editor always sees what readers will get, whether it is saved (`saved`: the
 * view as last saved) and how to go back to it.
 *
 * `groups` (regions and custom regions with their countries, e.g. from
 * `getCountryGroups()`) enable framing a region and adding whole regions.
 */
export function MapVisualBuilder({
  value,
  onChange,
  groups,
  saved = null,
}: {
  value: MapSpec | null;
  onChange: (spec: MapSpec) => void;
  groups?: CountryGroups[];
  /** The view as last saved; null for a map not saved yet. */
  saved?: MapView | null;
}) {
  const [fallback] = useState(emptyMapSpec);
  const spec = value ?? fallback;
  // Edits made before the parent re-renders build on each other, not on a stale prop.
  const current = useRef(spec);
  useLayoutEffect(() => {
    current.current = spec;
  });
  const [history, setHistory] = useState<History>(emptyHistory);
  // Bumped when the spec changes outside the panels' own fields (undo, a map
  // click), so uncontrolled fields (rich text, pickers) start again from it.
  const [generation, setGeneration] = useState(0);
  const [tab, setTab] = useState<Tab>("view");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [reader, setReader] = useState(false);
  const [status, setStatus] = useState("");
  // Where the editor moved the map away from a countries or region framing (null: it shows it).
  const [camera, setCamera] = useState<MapBounds | null>(null);
  // Bumped to send the map back to the framing.
  const [fitRequest, setFitRequest] = useState(0);
  const mapRef = useRef<MapLibreMap | null>(null);

  const edit: Edit = (update, key) => {
    const previous = current.current;
    const next = update(previous);
    if (next === previous) return;
    current.current = next;
    setHistory((past) => recordEdit(past, previous, key));
    onChange(next);
  };

  const stepBack = () => {
    const result = undo(history);
    if (!result) return;
    current.current = result.spec;
    setHistory(result.history);
    setGeneration((count) => count + 1);
    if (selectedId && !result.spec.points.some((point) => point.id === selectedId)) {
      setSelectedId(null);
    }
    onChange(result.spec);
    setStatus("Last change undone.");
  };

  const addAt = (at?: { lat: number; lon: number }) => {
    const center = mapRef.current?.getCenter();
    const place = at ?? (center ? pointPosition(center.lng, center.lat) : { lat: 0, lon: 0 });
    const selected = current.current.points.find((point) => point.id === selectedId);
    let added: string | null = null;
    edit((spec) => {
      const result = addPoint(spec, place, selected);
      added = result.id;
      return result.spec;
    });
    if (added) {
      setSelectedId(added);
      setTab("points");
      setStatus("Point added.");
    } else {
      setStatus(`The map already has ${MAP_LIMITS.points} points.`);
    }
  };

  /** The editor moved the map: a free view follows it, a framing waits for "Use this view". */
  const onCameraChange = (shown: MapBounds | null) => {
    if (shown && current.current.view.mode === "bounds") {
      // One undo step for a run of pans and zooms.
      edit((previous) => frameCamera(previous, shown), "view.camera");
      setCamera(null);
    } else {
      setCamera(shown);
    }
  };

  const adoptCamera = () => {
    if (!camera) return;
    edit((previous) => frameCamera(previous, camera));
    setCamera(null);
    setStatus("Free view: the map opens on this view.");
  };

  const backToFraming = () => setFitRequest((count) => count + 1);

  const resetToSaved = () => {
    if (!saved) return;
    edit((previous) => withFraming(previous, saved));
    setGeneration((count) => count + 1);
    setFitRequest((count) => count + 1);
    setStatus("Back to the saved view.");
  };

  const bytes = useMemo(() => specBytes(spec), [spec]);
  const tooBig = bytes > MAP_LIMITS.bytes;
  const untitled = untitledPoints(spec);
  const showPoint = (id: string) => {
    setSelectedId(id);
    setTab("points");
  };
  // A free view follows the map, so it is never "moved away" from; nor is a
  // framing that was taken from this very view (the same array).
  const moved = camera !== null && camera !== spec.view.bounds && spec.view.mode !== "bounds";
  const editing = reader
    ? undefined
    : {
        selectedId,
        onSelect: (id: string) => {
          setSelectedId(id);
          setTab("points");
        },
        onMovePoint: (id: string, position: { lat: number; lon: number }) => {
          edit((spec) => updatePoint(spec, id, position));
          setSelectedId(id);
          setTab("points");
        },
        onMapClick: ({ lat, lon, iso3 }: { lat: number; lon: number; iso3: string | null }) => {
          if (adding) {
            addAt(pointPosition(lon, lat));
          } else if (tab === "countries" && iso3) {
            edit((spec) => toggleHighlight(spec, iso3));
            setGeneration((count) => count + 1);
          }
        },
        onReady: (map: MapLibreMap) => {
          mapRef.current = map;
        },
        onCameraChange,
        fitRequest,
      };

  const panel = { spec, edit, generation };
  return (
    // Side by side only when the form itself is wide (a container query, not the
    // window): in a narrow column the map would shrink to a strip.
    <div className="@container">
      <div className="grid gap-4 @4xl:grid-cols-[minmax(0,7fr)_minmax(20rem,3fr)] @4xl:items-start">
        <div className="grid gap-2 @4xl:sticky @4xl:top-4">
          <div role="toolbar" aria-label="Map tools" className="flex flex-wrap items-center gap-2">
            <Button
              variant={adding ? "primary" : "outline"}
              size="sm"
              aria-pressed={adding}
              disabled={reader || spec.points.length >= MAP_LIMITS.points}
              onClick={() => setAdding((on) => !on)}
            >
              <MousePointerClick size={15} aria-hidden />
              {adding ? "Click the map to add points" : "Add points"}
            </Button>
            <Button variant="outline" size="sm" disabled={!history.past.length} onClick={stepBack}>
              <Undo2 size={15} aria-hidden />
              Undo last change
            </Button>
            <Checkbox
              label="Preview as a reader"
              checked={reader}
              onChange={(event) => {
                setReader(event.target.checked);
                setAdding(false);
              }}
            />
          </div>
          <ViewStatus
            view={spec.view}
            saved={saved}
            moved={moved && !reader}
            disabled={reader}
            onUseView={adoptCamera}
            onBackToFraming={backToFraming}
            onResetToSaved={resetToSaved}
          />
          {untitled.length ? (
            <div
              role="status"
              data-testid="map-untitled-points"
              className="flex flex-wrap items-center gap-2 rounded-xl bg-[var(--color-danger-soft)] px-3 py-2 text-[12.5px] text-[var(--color-danger)]"
            >
              <span>
                {untitled.length === 1
                  ? "A point has no title."
                  : `${untitled.length} points have no title.`}{" "}
                Every point needs one (readers hear it and see it as the popup heading) before the
                map can be saved.
              </span>
              <Button variant="outline" size="sm" onClick={() => showPoint(untitled[0]!.id)}>
                {untitled.length === 1 ? "Give it a title" : "Show the first one"}
              </Button>
            </div>
          ) : null}
          <MapFrame
            spec={spec}
            editing={editing}
            className="rounded-xl ring-1 ring-[var(--color-line)]"
          >
            {adding || (tab === "countries" && !reader) ? (
              <p className="pointer-events-none absolute top-2 left-1/2 z-3 -translate-x-1/2 rounded-full bg-[var(--color-ink)]/85 px-3 py-1 text-[12px] text-white">
                {adding
                  ? "Click the map to add a point"
                  : "Click a country to highlight it (or not)"}
              </p>
            ) : null}
          </MapFrame>
          <p className="flex flex-wrap gap-x-4 text-[12px] text-[var(--color-ink-muted)]">
            <span>
              {spec.points.length}/{MAP_LIMITS.points} points · {spec.countries.length}/
              {MAP_LIMITS.countries} countries · {spec.legend.items.length}/{MAP_LIMITS.legendItems}{" "}
              legend items
            </span>
            <span className={tooBig ? "font-medium text-[var(--color-danger)]" : undefined}>
              {Math.ceil(bytes / 1000)} of {MAP_LIMITS.bytes / 1000} kB
              {tooBig ? " — too large to save: shorten popups or remove points" : ""}
            </span>
            <span role="status" aria-live="polite">
              {status}
            </span>
          </p>
        </div>
        <div className="grid gap-4">
          <Tabs label="Map settings" idBase={TABS_ID} items={TABS} value={tab} onChange={setTab} />
          <TabPanel idBase={TABS_ID} id="view" selected={tab === "view"}>
            <ViewPanel {...panel} groups={groups} camera={camera} />
          </TabPanel>
          <TabPanel idBase={TABS_ID} id="countries" selected={tab === "countries"}>
            <CountriesPanel {...panel} groups={groups} />
          </TabPanel>
          <TabPanel idBase={TABS_ID} id="points" selected={tab === "points"}>
            <PointsPanel
              {...panel}
              selectedId={selectedId}
              onSelect={setSelectedId}
              adding={adding}
              onToggleAdding={() => setAdding((on) => !on)}
              onAdd={addAt}
            />
          </TabPanel>
          <TabPanel idBase={TABS_ID} id="legend" selected={tab === "legend"}>
            <LegendPanel {...panel} />
          </TabPanel>
        </div>
      </div>
    </div>
  );
}
