/** Entry constants without Zod — client editor components may import them. */

/** Max topics (chapters) per dossier: two columns of tiles, six rows (DB allows 12). */
export const MAX_CHAPTERS = 12;

/** Shared preview validity periods in hours (the DB allows 1 to 720). */
export const PREVIEW_HOURS = [24, 72, 168, 720] as const;

/** Icons a learn-more tile may use (DB check `learn_more_tiles.icon`). */
export const TILE_ICONS = [
  "video",
  "chart",
  "book",
  "graduation",
  "mic",
  "pen",
  "map",
  "link",
  "file",
  "globe",
] as const;
export type TileIcon = (typeof TILE_ICONS)[number];

export const TILE_ICON_LABEL: Record<TileIcon, string> = {
  video: "Video",
  chart: "Chart",
  book: "Book",
  graduation: "Education",
  mic: "Lecture",
  pen: "Notes",
  map: "Map",
  link: "Link",
  file: "Document",
  globe: "Globe",
};

/** Search engine limits for the SEO fields (DB checks on `entries`). */
export const SEO_TITLE_MAX = 70;
export const SEO_DESCRIPTION_MAX = 170;
export const GEO_SUMMARY_MAX = 800;
