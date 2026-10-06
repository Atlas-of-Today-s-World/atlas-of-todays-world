import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import { ilikeAny } from "@/lib/db/filters";

/**
 * Redirects — admin reads (layer: features/<domain>/editorial.ts). Under the session,
 * no cache; the public side reads them through redirects/queries.ts.
 */

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
  const search = ilikeAny(["from_path", "to_path"], q);
  if (search) query = query.or(search);
  const { data, error } = await query;
  if (error) throw new Error(`[redirects] ${error.message}`);
  return data;
}
