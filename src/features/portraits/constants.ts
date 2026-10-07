/** Portrait code lists without Zod — the client section editor may import them. */

/** Source kinds — matching the CHECK in the resources table. */
export const RESOURCE_KINDS = [
  "Videos & Documentaries",
  "Lectures & Debates",
  "Articles, Reports & Books",
  "Educational Resources",
  "Statistics & Infographics",
] as const;

/** Special region type (special_regions.kind) — labels in the form and in lists. */
export const GROUP_KIND_LABEL = { region: "Custom region", issue: "Special region" } as const;

/**
 * Visual types in the "Maps & charts" carousel — matching the CHECK in visual_embeds.
 * The first one is preselected for a new item.
 */
export const VISUAL_PROVIDERS = ["image", "datawrapper", "flourish", "worldbank"] as const;

/** Content status of a region / global issue (DB `content_status`) — labels in the admin form. */
export const CONTENT_STATUS_LABEL = {
  none: "Not started (grey on the globe, asks for support)",
  preparing: "In preparation (hourglass)",
  ready: "Ready (check mark)",
} as const;
