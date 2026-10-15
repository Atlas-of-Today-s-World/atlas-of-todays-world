import "server-only";
import { must, rowsOf } from "@/lib/db/result";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Volunteer editors — admin reads (layer: features/<domain>/editorial.ts,
 * ARCHITEKTURA 4.1), under the user's session (RLS: accounts section), no cache.
 */

/** Where applications are sent, and the applications, newest first. */
export async function volunteersOverview() {
  const supabase = await createServerClient();
  const [settings, applications] = await Promise.all([
    supabase.from("volunteer_settings").select("notify_email").eq("id", 1).maybeSingle(),
    supabase
      .from("volunteer_applications")
      .select("id, name, email, topics, message, status, created_at, notified_at")
      .order("created_at", { ascending: false })
      .limit(2000),
  ]);
  return {
    notifyEmail: must(settings, "volunteers")?.notify_email ?? null,
    applications: rowsOf(applications, "volunteers"),
  };
}
