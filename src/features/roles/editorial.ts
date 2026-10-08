import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import { ilikeAny } from "@/lib/db/filters";

/** Roles, their permissions and security settings (under RLS — permissions section only). */
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
    // Counted in the database (security definer, `permissions` view): profiles RLS
    // would hide other accounts from an access manager without `users` view.
    supabase.rpc("role_holder_counts"),
  ]);
  for (const result of [roles, permissions, security, holders]) {
    if (result.error) throw new Error(`[roles] ${result.error.message}`);
  }
  const count = new Map((holders.data ?? []).map((row) => [row.role_id, Number(row.holders)]));
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

/**
 * Last 1000 changes; `q` searches the action and target in the DB (the table then
 * filters only within the loaded rows). Not actor_email: write_audit no longer fills it.
 */
export async function auditLog(q?: string): Promise<AuditRow[]> {
  const supabase = await createServerClient();
  let query = supabase
    .from("audit_log")
    .select("id, at, actor_email, action, target, detail")
    .order("at", { ascending: false })
    .limit(1000);
  const search = ilikeAny(["action", "target"], q);
  if (search) query = query.or(search);
  const { data, error } = await query;
  if (error) throw new Error(`[audit] ${error.message}`);
  return data as AuditRow[];
}
