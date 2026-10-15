import type { ComponentType } from "react";

/**
 * The slot for custom maps (visuals of kind 'map'), built in
 * `src/features/visuals/map/` by its own update. Everything else of Maps &
 * charts — the table, the admin editor, the carousel — only talks to the map
 * module through this file and `map-spec.ts`, so plugging it in is a change
 * of these two files alone:
 *
 *   export { MapVisualBuilder, MapVisual } from "./map";        // this file
 *   export { parseMapSpec } from "./map/spec";                   // map-spec.ts
 *
 * Until then both components are null: the admin shows "coming in the next
 * update" for a custom map, and the site skips map visuals.
 *
 * This module is imported by client components: it (and what it re-exports)
 * must stay free of Zod and server-only code (tests/unit/client-bundle.test.ts).
 */

/** A custom map's spec: a JSON object (the DB keeps at most 200 kB of it). */
export type MapSpec = Record<string, unknown>;

/** The admin's map builder: controlled, like a form field. */
export interface MapVisualBuilderProps {
  /** The stored spec; null for a new map. */
  value: MapSpec | null;
  /** Called with the spec after every change; the form posts the latest one. */
  onChange: (spec: MapSpec) => void;
}

/** A map in the "Maps & charts" carousel (and the admin preview). */
export interface MapVisualProps {
  spec: MapSpec;
  /** Accessible name of the map. */
  title: string;
  /** The editor's height hint in px, if any. */
  height?: number;
}

export const MapVisualBuilder: ComponentType<MapVisualBuilderProps> | null = null;
export const MapVisual: ComponentType<MapVisualProps> | null = null;
