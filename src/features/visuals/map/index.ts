/**
 * Custom map visual — the server-safe entry (validation and types). The
 * client components are imported from their own modules:
 * `./components/MapVisualBuilder` (admin) and `./components/MapVisual` (public).
 */
export { parseMapSpec } from "./schema";
export { emptyMapSpec, MAP_LIMITS, type MapSpec } from "./types";
