/**
 * The slot for custom maps (visuals of kind 'map'), built in
 * `src/features/visuals/map/`. Everything else of Maps & charts — the table,
 * the admin editor, the carousel — only talks to the map module through this
 * file, `map-builder-slot.ts` (the admin's builder) and `map-spec.ts`.
 *
 * This module is imported by client components: it (and what it re-exports)
 * must stay free of Zod and server-only code (tests/unit/client-bundle.test.ts).
 *
 * Public pages import it too (the carousel), so it re-exports nothing of the
 * admin: a server component that imports a barrel ships every client component
 * the barrel names, used or not — the builder here once put the rich-text
 * editor and the Supabase client (~190 kB gzipped) on every country page.
 */
export { emptyMapSpec, type MapSpec } from "./map/types";
/** A map in the "Maps & charts" carousel (and the admin preview). */
export { MapVisual } from "./map/components/MapVisual";
