/**
 * Colours for code that can't read CSS variables: MapLibre paint, canvas
 * drawing, OG images (Satori), the web manifest and the browser theme colour.
 * Each equals its `--color-*` token in globals.css (palette.test.ts enforces it).
 */
export const THEME_COLORS = {
  space: "#0a1020",
  spaceDeep: "#070b16",
  inkDeep: "#0d1324",
  accent: "#3b4ce0",
  patron: "#2563eb",
  statusReady: "#1e9e5a",
  statusPreparing: "#d98a00",
} as const;

/** Globe colours with no CSS counterpart, shared by the map style and its repaints. */
export const GLOBE_COLORS = {
  /** Countries before (or without) a colour layer. */
  land: "#7d8aa8",
  /** Text of a topic count on its white pill (also `.topic-pulse` in globals.css). */
  badgeText: "#0b1220",
  /** A place without topics: red pill and its pulsing glow (an invitation to write). */
  empty: "#dc2626",
} as const;
