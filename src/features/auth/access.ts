import "server-only";
import { NextResponse } from "next/server";
import { cache } from "react";
import { createServerClient } from "@/lib/supabase/server";

const SECTIONS = [
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
 * Pro Route Handlery: ověří přihlášení a oprávnění sám, nespoléhá na middleware
 * (ARCHITEKTURA 4.3). Vrací buď přístup, nebo hotovou odpověď 401/403.
 */
export async function requirePermission(
  section: Section,
  action: Action,
): Promise<{ access: Access } | { response: NextResponse }> {
  const access = await getAccess();
  if (!access) {
    return { response: NextResponse.json({ error: "Sign in first." }, { status: 401 }) };
  }
  if (!can(access.permissions, section, action)) {
    return {
      response: NextResponse.json({ error: "Your role does not allow this." }, { status: 403 }),
    };
  }
  return { access };
}
