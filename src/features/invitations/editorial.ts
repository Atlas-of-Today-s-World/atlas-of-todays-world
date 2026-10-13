import "server-only";
import { must } from "@/lib/db/result";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Team invitations — admin reads (layer: features/<domain>/editorial.ts,
 * ARCHITEKTURA 4.1), under the user's session (RLS: accounts section), no cache.
 */

/** Sent invitations, newest first. */
export async function listInvitations() {
  const supabase = await createServerClient();
  return must(
    await supabase
      .from("invitations")
      .select("id, email, role_id, created_at, expires_at, accepted_at, revoked_at")
      .order("created_at", { ascending: false })
      .limit(500),
    "invitations",
  );
}
