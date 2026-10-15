/**
 * The slot for custom maps (visuals of kind 'map'), built in
 * `src/features/visuals/map/`. Everything else of Maps & charts — the table,
 * the admin editor, the carousel — only talks to the map module through this
 * file and `map-spec.ts`.
 *
 * This module is imported by client components: it (and what it re-exports)
 * must stay free of Zod and server-only code (tests/unit/client-bundle.test.ts).
 */
export { emptyMapSpec, type MapSpec } from "./map/types";
/** The admin's map builder: controlled, like a form field (`value`, `onChange`). */
export { MapVisualBuilder } from "./map/components/MapVisualBuilder";
/** A map in the "Maps & charts" carousel (and the admin preview). */
export { MapVisual } from "./map/components/MapVisual";
