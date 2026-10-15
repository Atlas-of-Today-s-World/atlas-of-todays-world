import "server-only";
import { must, rowsOf } from "@/lib/db/result";
import type { Tables } from "@/lib/db/types.gen";
import { createServerClient } from "@/lib/supabase/server";

/**
 * UI texts — admin reads (layer: features/<domain>/editorial.ts). Under the
 * session, no cache: the list shows the saved state right after a save. Every
 * row, also one that no longer fits en.json (the admin can still reset it).
 */

export type OverrideRecord = Pick<Tables<"ui_text_overrides">, "key" | "value" | "updated_at">;

export async function getUiTextOverride(key: string): Promise<OverrideRecord | null> {
  const supabase = await createServerClient();
  return must(
    await supabase
      .from("ui_text_overrides")
      .select("key, value, updated_at")
      .eq("key", key)
      .maybeSingle(),
    "ui-texts",
  );
}

export async function listUiTextOverrides(): Promise<OverrideRecord[]> {
  const supabase = await createServerClient();
  return rowsOf(
    await supabase.from("ui_text_overrides").select("key, value, updated_at").order("key"),
    "ui-texts",
  );
}
