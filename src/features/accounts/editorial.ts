import "server-only";
import { createServerClient } from "@/lib/supabase/server";

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

/** Účty podle druhu (tým / čtenáři) — RLS ukáže jen správcům účtů. */
export async function listAccounts(kind: "staff" | "reader", q?: string): Promise<AccountRow[]> {
  const supabase = await createServerClient();
  let query = supabase
    .from("profiles")
    .select(COLUMNS)
    .eq("kind", kind)
    .is("deleted_at", null)
    .order("email")
    .limit(500);
  // Hodnota ve filtru .or() v uvozovkách, bez znaků, které by filtr rozbily nebo změnily.
  const needle = q
    ?.trim()
    .replace(/[%_,()"\\]/g, "")
    .slice(0, 100);
  if (needle) query = query.or(`email.ilike."%${needle}%",name.ilike."%${needle}%"`);
  const { data, error } = await query;
  if (error) throw new Error(`[accounts] ${error.message}`);
  return data as AccountRow[];
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
  if (profile.error) throw new Error(`[accounts] ${profile.error.message}`);
  if (!profile.data) return null;
  return {
    ...(profile.data as AccountRow & { blocked_note: string | null; approval_global: boolean }),
    countries: (countries.data ?? []).map((row) => row.country_iso3),
    authors: (authors.data ?? []).map((row) => row.author_id),
  };
}

export async function listRoles() {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("roles")
    .select("id, name, note, locked, news_scope, approval_scope, position")
    .order("position");
  if (error) throw new Error(`[roles] ${error.message}`);
  return data;
}
