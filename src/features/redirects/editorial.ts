import "server-only";
import { createServerClient } from "@/lib/supabase/server";

export interface RedirectRow {
  id: string;
  from_path: string;
  to_path: string;
  permanent: boolean;
  created_at: string;
}

/** List of redirects for the admin (under the session, no cache). */
export async function listRedirects(q?: string): Promise<RedirectRow[]> {
  const supabase = await createServerClient();
  let query = supabase
    .from("redirects")
    .select("id, from_path, to_path, permanent, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  // Value in the .or() filter is quoted and without characters that would break the filter (as for accounts).
  const term = q
    ?.trim()
    .replace(/[%_,()"\\]/g, "")
    .slice(0, 100);
  if (term) query = query.or(`from_path.ilike."%${term}%",to_path.ilike."%${term}%"`);
  const { data, error } = await query;
  if (error) throw new Error(`[redirects] ${error.message}`);
  return data;
}
