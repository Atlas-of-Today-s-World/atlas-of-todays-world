import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import { ilikeAny } from "@/lib/db/filters";
import { must } from "@/lib/db/result";

/**
 * Accounts — admin reads (layer: features/<domain>/editorial.ts, ARCHITEKTURA 4.1).
 * Runs under the signed-in user's session without a cache: RLS decides who
 * sees which accounts, so the same query is safe for every role.
 */

export interface AccountRow {
  id: string;
  email: string;
  name: string;
  role_id: string;
  kind: "staff" | "reader";
  status: "active" | "pending" | "blocked";
  created_at: string;
  last_seen_at: string | null;
}

const COLUMNS = "id, email, name, role_id, kind, status, created_at, last_seen_at";

/** Accounts by kind (team / readers) — RLS shows them only to account managers. */
export async function listAccounts(kind: "staff" | "reader", q?: string): Promise<AccountRow[]> {
  const supabase = await createServerClient();
  let query = supabase
    .from("profiles")
    .select(COLUMNS)
    .eq("kind", kind)
    .is("deleted_at", null)
    .order("email")
    .limit(500);
  const search = ilikeAny(["email", "name"], q);
  if (search) query = query.or(search);
  return must(await query, "accounts") as AccountRow[];
}

export async function accountForEdit(id: string) {
  const supabase = await createServerClient();
  const [profile, countries, authors] = await Promise.all([
    supabase
      .from("profiles")
      .select(`${COLUMNS}, blocked_note, approval_global`)
      .eq("id", id)
      .maybeSingle(),
    supabase.from("approver_countries").select("country_iso3").eq("user_id", id),
    supabase.from("approver_authors").select("author_id").eq("user_id", id),
  ]);
  const row = must(profile, "accounts");
  if (!row) return null;
  return {
    ...(row as AccountRow & { blocked_note: string | null; approval_global: boolean }),
    countries: (countries.data ?? []).map((row) => row.country_iso3),
    authors: (authors.data ?? []).map((row) => row.author_id),
  };
}
