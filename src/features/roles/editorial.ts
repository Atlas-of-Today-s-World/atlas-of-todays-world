import "server-only";
import { createServerClient } from "@/lib/supabase/server";

/** Role, jejich oprávnění a bezpečnostní nastavení (pod RLS — jen sekce permissions). */
export async function rolesOverview() {
  const supabase = await createServerClient();
  const [roles, permissions, security, holders] = await Promise.all([
    supabase
      .from("roles")
      .select("id, name, note, locked, news_scope, approval_scope, position")
      .order("position"),
    supabase.from("role_permissions").select("role_id, section, actions"),
    supabase
      .from("security_settings")
      .select("session_hours, lock_after, invite_only, require_2fa_roles")
      .eq("id", 1)
      .maybeSingle(),
    supabase.from("profiles").select("role_id").is("deleted_at", null).limit(5000),
  ]);
  for (const result of [roles, permissions, security]) {
    if (result.error) throw new Error(`[roles] ${result.error.message}`);
  }
  const count = new Map<string, number>();
  for (const row of holders.data ?? []) count.set(row.role_id, (count.get(row.role_id) ?? 0) + 1);
  return {
    roles: (roles.data ?? []).map((role) => ({ ...role, holders: count.get(role.id) ?? 0 })),
    permissions: permissions.data ?? [],
    security: security.data,
  };
}

export interface AuditRow {
  id: number;
  at: string;
  actor_email: string | null;
  action: string;
  target: string | null;
  detail: unknown;
}

export async function auditLog({
  action,
  target,
}: {
  action?: string;
  target?: string;
}): Promise<AuditRow[]> {
  const supabase = await createServerClient();
  let query = supabase
    .from("audit_log")
    .select("id, at, actor_email, action, target, detail")
    .order("at", { ascending: false })
    .limit(300);
  if (action?.trim()) query = query.ilike("action", `%${action.trim().replace(/[%_]/g, "")}%`);
  if (target?.trim()) query = query.ilike("target", `%${target.trim().replace(/[%_]/g, "")}%`);
  const { data, error } = await query;
  if (error) throw new Error(`[audit] ${error.message}`);
  return data as AuditRow[];
}
