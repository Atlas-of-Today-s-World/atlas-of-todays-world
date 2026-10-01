import "server-only";
import { cache } from "react";
import { createServerClient } from "@/lib/supabase/server";
import { SECTIONS, type Action, type Section } from "./sections";

export type { Action, Section };

export type Permissions = Record<Section, string>;

export interface Access {
  userId: string;
  email: string | null;
  roleId: string | null;
  roleName: string | null;
  permissions: Permissions;
}

const NONE = Object.fromEntries(SECTIONS.map((section) => [section, ""])) as Permissions;

export function can(permissions: Permissions, section: Section, action: Action): boolean {
  return permissions[section]?.includes(action) ?? false;
}

/** Smí vůbec do administrace (aspoň jedna sekce k zobrazení)? */
export function isStaff(permissions: Permissions): boolean {
  return SECTIONS.some((section) => can(permissions, section, "v"));
}

/**
 * Přihlášený uživatel a jeho oprávnění z DB (`my_permissions()`, ARCHITEKTURA 7.2).
 * Slouží UI (menu, tlačítka); o zápisu rozhoduje vždy RLS.
 */
export const getAccess = cache(async function getAccess(): Promise<Access | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: rows }, { data: role }] = await Promise.all([
    supabase.rpc("my_permissions"),
    supabase.rpc("my_role"),
  ]);
  const permissions = { ...NONE };
  for (const row of rows ?? []) {
    if ((SECTIONS as readonly string[]).includes(row.section)) {
      permissions[row.section as Section] = row.actions;
    }
  }
  return {
    userId: user.id,
    email: user.email ?? null,
    roleId: role?.id ?? null,
    roleName: role?.name ?? null,
    permissions,
  };
});

/**
 * Pro stránku sekce administrace: přístup, pokud má uživatel v sekci danou
 * akci, jinak null (stránka ukáže „Nemáte oprávnění"). Jen UX — data chrání RLS.
 */
export async function sectionAccess(section: Section, action: Action = "v") {
  const access = await getAccess();
  return access && can(access.permissions, section, action) ? access : null;
}
