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
