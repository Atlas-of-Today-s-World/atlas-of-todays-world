/**
 * Validation of a custom map's spec (server side) — the other half of the map
 * slot (see map-slot.ts): on save (schema.ts) and again when a stored spec is
 * read for the site or the editor (rows.ts), so popup HTML is sanitized both
 * times and a spec that no longer validates is left out.
 *
 *   parseMapSpec(json: unknown) → { ok: true, spec } | { ok: false, error }
 */
export { parseMapSpec } from "./map";
