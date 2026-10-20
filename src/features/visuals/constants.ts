/** Maps & charts code lists and limits without Zod — the client editor may import them. */

/**
 * Whose visuals: a region, a global issue (incl. a custom region), a topic
 * (entries of kind 'entry') or one of its subtopics (entry_chapters) — the
 * CHECK `visuals_owner_kind_check` (migration 20261015000100).
 */
export const VISUAL_OWNERS = ["region", "issue", "entry", "chapter"] as const;
export type VisualOwnerKind = (typeof VISUAL_OWNERS)[number];

/** What a visual is — the CHECK `visuals_kind_check`. */
export const VISUAL_KINDS = ["embed", "image", "map", "html"] as const;
export type VisualKind = (typeof VISUAL_KINDS)[number];

export const VISUAL_KIND_LABEL: Record<VisualKind, string> = {
  embed: "Embedded chart",
  image: "Image",
  map: "Custom map",
  html: "Custom code (HTML)",
};

/** Limits of the DB CHECKs. */
export const VISUAL_LIMITS = {
  title: 200,
  caption: 600,
  sourceLabel: 120,
  url: 1000,
  /** `map_spec` as JSON text, in bytes (200 kB). */
  mapSpec: 204_800,
  /** `html` (custom code), in bytes (512 kB) — `visuals_html_len`. */
  html: 524_288,
} as const;
