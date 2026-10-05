/** Entry constants without Zod — client editor components may import them. */

/** Max articles (chapters) per topic: two columns of tiles, six rows (DB allows 12). */
export const MAX_CHAPTERS = 12;

/** Max links in the "Learn more" tiles of one topic (DB `replace_entry_parts`). */
export const MAX_LINKS = 200;

/** Max "Learn more" tiles of one topic or template (DB `replace_tiles`). */
export const MAX_TILES = 24;

/** Shared preview validity periods in hours (the DB allows 1 to 720). */
export const PREVIEW_HOURS = [24, 72, 168, 720] as const;

/** Icons a tile may use (DB `is_tile_icon`); the picture is in TileIcon.tsx. */
export const TILE_ICONS = [
  "video",
  "podcast",
  "mic",
  "chart",
  "database",
  "map",
  "book",
  "news",
  "file",
  "pen",
  "quote",
  "graduation",
  "idea",
  "people",
  "landmark",
  "scale",
  "shield",
  "flag",
  "heart",
  "leaf",
  "calendar",
  "image",
  "globe",
  "link",
] as const;
export type TileIcon = (typeof TILE_ICONS)[number];

/** A stored icon name → a known one ("link" for anything unexpected). */
export const toTileIcon = (value: string): TileIcon =>
  (TILE_ICONS as readonly string[]).includes(value) ? (value as TileIcon) : "link";

export const TILE_ICON_LABEL: Record<TileIcon, string> = {
  video: "Video",
  podcast: "Podcast",
  mic: "Lecture",
  chart: "Chart",
  database: "Data",
  map: "Map",
  book: "Book",
  news: "News",
  file: "Document",
  pen: "Notes",
  quote: "Quote",
  graduation: "Education",
  idea: "Idea",
  people: "People",
  landmark: "Institution",
  scale: "Law",
  shield: "Security",
  flag: "Country",
  heart: "Aid",
  leaf: "Environment",
  calendar: "Events",
  image: "Images",
  globe: "Globe",
  link: "Link",
};

/** Globe layers a topic can be counted on (DB `entries.map_layers`). */
export const MAP_LAYERS = ["countries", "regions", "issues"] as const;
export type MapLayer = (typeof MAP_LAYERS)[number];

export const MAP_LAYER_LABEL: Record<MapLayer, string> = {
  countries: "Countries",
  regions: "Regions",
  issues: "Global issues",
};

/** Search engine limits for the SEO fields (DB checks on `entries`). */
export const SEO_TITLE_MAX = 70;
export const SEO_DESCRIPTION_MAX = 170;
export const GEO_SUMMARY_MAX = 800;
