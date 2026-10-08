// Permission matrix labels without Zod (the client PermissionMatrix imports them too).
import type { SECTIONS } from "@/features/auth/sections";

/** Labels of permission sections (role_permissions.section) for the matrix. */
export const SECTION_LABEL: Record<(typeof SECTIONS)[number], string> = {
  news: "Articles",
  approvals: "Article approvals",
  regions: "Regions & countries",
  specials: "Global issues",
  layers: "Map data layers",
  areas: "Custom map areas",
  appearance: "Map appearance",
  users: "Accounts & invitations",
  permissions: "Roles & permissions",
  members: "Patron memberships",
};
