// Popisky matice oprávnění bez Zodu (importuje je i klientská RoleForms).
import type { SECTIONS } from "@/features/auth/sections";

/** Popisky sekcí oprávnění (role_permissions.section) pro matici. */
export const SECTION_LABEL: Record<(typeof SECTIONS)[number], string> = {
  news: "News & entries",
  approvals: "Approvals",
  regions: "Regions & countries",
  specials: "Global Issues",
  layers: "Data layers",
  areas: "Map areas",
  appearance: "Map appearance",
  users: "Accounts",
  permissions: "Roles & permissions",
  members: "Members",
};

export const ACTION_LABEL = { v: "view", c: "add", e: "edit", d: "delete" } as const;
