/** Číselníky portrétů bez Zodu — smí je importovat i klientský editor sekcí. */

/** Druhy zdrojů — shodné s CHECK v tabulce resources. */
export const RESOURCE_KINDS = [
  "Videos & Documentaries",
  "Lectures & Debates",
  "Articles, Reports & Books",
  "Educational Resources",
  "Statistics & Infographics",
] as const;

/** Typ skupiny zemí (special_regions.kind) — popisky ve formuláři a v seznamech. */
export const GROUP_KIND_LABEL = { region: "Custom region", issue: "Global issue" } as const;
