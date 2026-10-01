// Popisky matice oprávnění bez Zodu (importuje je i klientská RoleForms).
import type { SECTIONS } from "@/features/auth/sections";

/** Popisky sekcí oprávnění (role_permissions.section) pro matici. */
export const SECTION_LABEL: Record<(typeof SECTIONS)[number], string> = {
  news: "Novinky a hesla",
  approvals: "Schvalování",
  regions: "Regiony a země",
  specials: "Global Issues",
  layers: "Datové vrstvy",
  areas: "Mapové oblasti",
  appearance: "Vzhled mapy",
  users: "Účty",
  permissions: "Role a práva",
  members: "Členové",
};

export const ACTION_LABEL = { v: "zobrazit", c: "přidat", e: "upravit", d: "smazat" } as const;
