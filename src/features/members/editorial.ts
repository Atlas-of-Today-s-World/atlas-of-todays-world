import "server-only";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Atlas Patrons — admin reads (layer: features/<domain>/editorial.ts, ARCHITEKTURA 4.1).
 * `members_overview` is security_invoker, so profiles and memberships RLS decide
 * what the signed-in person sees. Filtering happens in the database: PostgREST
 * returns at most 1000 rows, so filtering a page of all accounts in JS would
 * silently drop memberships once there are more readers than that.
 */

/** Accounts with a membership (any plan but `none`). */
export async function listMemberships() {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("members_overview")
    .select(
      "id, name, email, plan, membership_status, complimentary, paying_since, current_period_end, pages_read",
    )
    .neq("plan", "none")
    .order("email");
  if (error) throw new Error(`[members] ${error.message}`);
  return data;
}

/** Accounts without a membership — candidates for a complimentary one. */
export async function accountsWithoutMembership(): Promise<{ id: string; label: string }[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("members_overview")
    .select("id, name, email")
    .eq("plan", "none")
    .order("email")
    .limit(1000);
  if (error) throw new Error(`[members] ${error.message}`);
  return data.map((row) => ({ id: row.id ?? "", label: row.name || row.email || "" }));
}
