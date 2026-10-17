// Role labels and code lists without Zod (the client PermissionMatrix and RoleForm import them too).
import type { SECTIONS } from "@/config/sections";

type SectionKey = (typeof SECTIONS)[number];

/** Labels of permission sections (role_permissions.section) for the matrix. */
export const SECTION_LABEL: Record<SectionKey, string> = {
  news: "Entries",
  approvals: "Approvals",
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
  news: "Entries (encyclopedia articles with subtopics) and the editorial pages listed under them.",
  approvals: "Reviewing and approving submitted entries.",
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

/** Whose articles a role edits (`roles.news_scope`). */
export const NEWS_SCOPES = ["none", "own", "all"] as const;
export const NEWS_SCOPE_LABEL: Record<(typeof NEWS_SCOPES)[number], string> = {
  none: "None",
  own: "Only their own",
  all: "All articles",
};

/** Which articles a role approves (`roles.approval_scope`). */
export const APPROVAL_SCOPES = ["none", "assigned", "global"] as const;
export const APPROVAL_SCOPE_LABEL: Record<(typeof APPROVAL_SCOPES)[number], string> = {
  none: "None",
  assigned: "Articles of assigned countries and authors",
  global: "All articles",
};
