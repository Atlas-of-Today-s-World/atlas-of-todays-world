/**
 * Permission sections (role_permissions.section) and actions "vced" — a fixed
 * list matching the CHECK in the DB. No server dependency (the client uses it too).
 */
export const SECTIONS = [
  "news",
  "approvals",
  "areas",
  "regions",
  "layers",
  "appearance",
  "specials",
  "users",
  "members",
  "permissions",
] as const;
export type Section = (typeof SECTIONS)[number];
export type Action = "v" | "c" | "e" | "d";
