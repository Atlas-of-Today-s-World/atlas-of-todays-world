import { z } from "zod";
import { SECTIONS } from "@/features/auth/sections";
import { checkbox, requiredText, slug, text } from "@/lib/validation/common";

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

/** Akce jedné sekce ve tvaru DB: „v", „vc", „vced"… (bez „v" nic dalšího). */
const actions = z
  .array(z.enum(["v", "c", "e", "d"]))
  .transform((list) =>
    list.includes("v")
      ? ["v", "c", "e", "d"].filter((a) => list.includes(a as never)).join("")
      : "",
  );

export const MatrixInput = z.object({
  role_id: slug(40),
  sections: z.record(z.enum(SECTIONS), actions),
});

export const RoleInput = z.object({
  id: slug(40),
  is_new: checkbox,
  name: requiredText(60),
  note: text(500),
  news_scope: z.enum(["none", "own", "all"]),
  approval_scope: z.enum(["none", "assigned", "global"]),
});

export const SecurityInput = z.object({
  session_hours: z.coerce.number().int().min(1).max(720),
  lock_after: z.coerce.number().int().min(1).max(20),
  invite_only: checkbox,
  require_2fa_roles: z.array(slug(40)).max(20),
});
