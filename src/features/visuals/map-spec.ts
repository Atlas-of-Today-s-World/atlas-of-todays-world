import type { MapSpec } from "./map-slot";

/**
 * Validation of a custom map's spec on save (server side) — the other half of
 * the map slot (see map-slot.ts). The map module replaces this file's body
 * with `export { parseMapSpec } from "./map/spec";`, keeping the contract:
 *
 *   parseMapSpec(json: unknown) → { ok: true, spec } | { ok: false, error }
 *
 * `json` is the parsed JSON the builder produced; `spec` is what is stored
 * (the DB adds: a JSON object of at most 200 kB). Until the map module lands,
 * no map can be saved.
 */
export type ParsedMapSpec = { ok: true; spec: MapSpec } | { ok: false; error: string };

export function parseMapSpec(json: unknown): ParsedMapSpec {
  void json;
  return { ok: false, error: "Custom maps arrive with the next update." };
}
