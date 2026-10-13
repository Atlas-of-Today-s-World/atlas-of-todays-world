// Permission matrix labels without Zod (the client PermissionMatrix imports them too).
import type { SECTIONS } from "@/features/auth/sections";

type SectionKey = (typeof SECTIONS)[number];

/** Labels of permission sections (role_permissions.section) for the matrix. */
export const SECTION_LABEL: Record<SectionKey, string> = {
  news: "Articles",
  approvals: "Article approvals",
  regions: "Regions & countries",
  specials: "Global issues",
  layers: "Map data layers",
  areas: "Custom map areas",
  appearance: "Map appearance",
  site: "Site content & settings",
  users: "Accounts & invitations",
  permissions: "Roles & permissions",
  members: "Patron memberships",
};

/** One-line explanation of a section, shown as a tooltip in the matrix. */
export const SECTION_DESCRIPTION: Record<SectionKey, string> = {
  news: "Articles, topics and the editorial pages listed under them.",
  approvals: "Reviewing and approving submitted articles.",
  regions: "Region and country pages and their data.",
  specials: "Global issue pages.",
  layers: "Indicators and their values on the map.",
  areas: "Hand-drawn map areas.",
  appearance: "Colours and styling of the map.",
  site: "Site-wide content: organisation settings, menus, legal and about pages, UI texts, home page, patron settings.",
  users: "User accounts, invitations and volunteer editors.",
  permissions: "Roles and this permission matrix.",
  members: "Patron memberships.",
};
