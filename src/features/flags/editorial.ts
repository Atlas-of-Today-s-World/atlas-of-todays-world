import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import { must } from "@/lib/db/result";

/**
 * Switches and the maintenance message — admin reads (layer:
 * features/<domain>/editorial.ts). Under the session, no cache; the public
 * site reads them through flags/queries.ts.
 */

export interface FlagRow {
  key: string;
  enabled: boolean;
  note: string;
  updated_at: string;
}

export interface MaintenanceMessage {
  maintenance_title: string;
  maintenance_text: string;
  updated_at: string | null;
}

/** Every switch, by key. */
export async function listFlags(): Promise<FlagRow[]> {
  const supabase = await createServerClient();
  return must(
    await supabase.from("feature_flags").select("key, enabled, note, updated_at").order("key"),
    "flags",
  );
}

/** One switch (null = no such key). */
export async function getFlag(key: string): Promise<FlagRow | null> {
  const supabase = await createServerClient();
  return must(
    await supabase
      .from("feature_flags")
      .select("key, enabled, note, updated_at")
      .eq("key", key)
      .maybeSingle(),
    "flags",
  );
}

/** The stored maintenance title/text (the single site_notices row). */
export async function getMaintenanceMessage(): Promise<MaintenanceMessage> {
  const supabase = await createServerClient();
  const data = must(
    await supabase
      .from("site_notices")
      .select("maintenance_title, maintenance_text, updated_at")
      .maybeSingle(),
    "site-notices",
  );
  return data ?? { maintenance_title: "", maintenance_text: "", updated_at: null };
}
