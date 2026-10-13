import "server-only";
import { must } from "@/lib/db/result";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Feature flags — admin read (layer: features/<domain>/editorial.ts,
 * ARCHITEKTURA 4.1), under the user's session, no cache.
 */

/** Every flag with its note, by key (the switches on the roles page). */
export async function listFlags() {
  const supabase = await createServerClient();
  return must(
    await supabase.from("feature_flags").select("key, enabled, note").order("key"),
    "flags",
  );
}
