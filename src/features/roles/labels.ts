// Popisky matice oprávnění bez Zodu (importuje je i klientská PermissionMatrix).
import type { SECTIONS } from "@/features/auth/sections";

/** Popisky sekcí oprávnění (role_permissions.section) pro matici. */
export const SECTION_LABEL: Record<(typeof SECTIONS)[number], string> = {
  news: "Articles",
  approvals: "Article approvals",
  regions: "Regions & countries",
  specials: "Country groups",
  layers: "Map data layers",
  areas: "Custom map areas",
  appearance: "Map appearance",
  users: "Accounts & invitations",
  permissions: "Roles & permissions",
  members: "Patron memberships",
};
