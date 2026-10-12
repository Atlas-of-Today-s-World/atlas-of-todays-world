import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import { ilikeAny } from "@/lib/db/filters";
import { auditActorLabel, chunk } from "./audit";

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
  /** E-mail of the account that made the change, a short account id, or "system". */
  who: string;
  action: string;
  target: string | null;
  detail: unknown;
}

/** Ids per `in.(…)` filter: 100 uuids keep the request URL well under server limits. */
const IDS_PER_REQUEST = 100;

/**
 * Last 1000 changes; `q` searches the action, target and the actor's e-mail in the DB
 * (the table then filters only within the loaded rows). write_audit stores only the
 * actor's id (DB-14), so e-mails come from the accounts — under profiles RLS: a viewer
 * without the right to see accounts finds and sees only their own (D-L5).
 */
export async function auditLog(q?: string): Promise<AuditRow[]> {
  const supabase = await createServerClient();
  let query = supabase
    .from("audit_log")
    .select("id, at, actor, actor_email, action, target, detail")
    .order("at", { ascending: false })
    .limit(1000);
  const search = ilikeAny(["action", "target", "actor_email"], q);
  if (search) {
    const emailSearch = ilikeAny(["email"], q) as string;
    const matching = await supabase.from("profiles").select("id").or(emailSearch).limit(100);
    if (matching.error) throw new Error(`[audit] ${matching.error.message}`);
    const actors = (matching.data ?? []).map((row) => row.id);
    query = query.or(actors.length ? `${search},actor.in.(${actors.join(",")})` : search);
  }
  const { data, error } = await query;
  if (error) throw new Error(`[audit] ${error.message}`);

  const emails = new Map<string, string>();
  const actorIds = [...new Set(data.flatMap((row) => (row.actor ? [row.actor] : [])))];
  const lookups = await Promise.all(
    chunk(actorIds, IDS_PER_REQUEST).map((ids) =>
      supabase.from("profiles").select("id, email").in("id", ids),
    ),
  );
  for (const lookup of lookups) {
    if (lookup.error) throw new Error(`[audit] ${lookup.error.message}`);
    for (const row of lookup.data ?? []) emails.set(row.id, row.email);
  }

  return data.map((row) => ({
    id: row.id,
    at: row.at,
    who: auditActorLabel(row.actor, row.actor_email, emails),
    action: row.action,
    target: row.target,
    detail: row.detail,
  }));
}
