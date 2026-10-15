import "server-only";
import { cache } from "react";
import { createServerClient } from "@/lib/supabase/server";
import { SECTIONS, type Action, type Permissions, type Section } from "@/config/sections";

export interface Access {
  userId: string;
  email: string | null;
  roleId: string | null;
  roleName: string | null;
  /**
   * Holds the locked admin role — what the DB's `is_admin()` checks. Only for
   * the few rules the DB keeps to the admin alone (complimentary memberships);
   * everything else goes by `permissions`.
   */
  isAdmin: boolean;
  permissions: Permissions;
}

const NONE = Object.fromEntries(SECTIONS.map((section) => [section, ""])) as Permissions;

export function can(permissions: Permissions, section: Section, action: Action): boolean {
  return permissions[section]?.includes(action) ?? false;
}

/** May they access the admin at all (at least one section to show)? */
export function isStaff(permissions: Permissions): boolean {
  return SECTIONS.some((section) => can(permissions, section, "v"));
}

/**
 * The signed-in user and their permissions from the DB (`my_permissions()`, ARCHITEKTURA 7.2).
 * Serves the UI (menu, buttons); writes are always decided by RLS.
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
    isAdmin: role?.locked === true,
    permissions,
  };
});

/**
 * For an admin section page: access if the user has the given action in the
 * section, otherwise null (the page shows "You don't have permission"). UX only — RLS protects the data.
 * With several sections, the action in any one of them is enough.
 */
export async function sectionAccess(section: Section | readonly Section[], action: Action = "v") {
  const access = await getAccess();
  const sections: readonly Section[] = typeof section === "string" ? [section] : section;
  return access && sections.some((one) => can(access.permissions, one, action)) ? access : null;
}
