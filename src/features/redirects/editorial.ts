import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import { ilikeAny } from "@/lib/db/filters";
import { must } from "@/lib/db/result";
import type { RedirectRow } from "./types";

/**
 * Redirects — admin reads (layer: features/<domain>/editorial.ts). Under the session,
 * no cache; the public side reads them through redirects/queries.ts.
 */

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
  return must(await query, "redirects");
}

/** One redirect for the edit form (null = no such id). */
export async function getRedirect(id: string): Promise<RedirectRow | null> {
  const supabase = await createServerClient();
  return must(
    await supabase
      .from("redirects")
      .select("id, from_path, to_path, permanent, created_at")
      .eq("id", id)
      .maybeSingle(),
    "redirects",
  );
}
