import "server-only";
import { can, type Action, type Permissions } from "@/features/auth/access";
import { createServerClient } from "@/lib/supabase/server";
import { FALLBACK_PATRON_SETTINGS } from "./config";
import { PATRON_SETTINGS_COLUMNS, rowFromSettings, type PatronSettingsRow } from "./settings";

/**
 * Atlas Patrons — admin reads (layer: features/<domain>/editorial.ts), under
 * the session, no cache. The public side reads through queries.ts.
 */

/**
 * The settings and FAQ belong to two permission sections: `site` (site
 * content) and `members` (patron memberships); either one is enough — the
 * same rule as the RLS policies of patron_settings / patron_faq.
 */
export const patronRight = (permissions: Permissions, action: Action) =>
  can(permissions, "site", action) || can(permissions, "members", action);

/** The settings row for the form (the previous constants if the row is missing). */
export async function getPatronSettingsRow(): Promise<PatronSettingsRow> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("patron_settings")
    .select(PATRON_SETTINGS_COLUMNS)
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(`[patron_settings] ${error.message}`);
  return data ?? rowFromSettings(FALLBACK_PATRON_SETTINGS);
}

export interface PatronFaqRow {
  id: string;
  question: string;
  answer_html: string;
  sort: number;
  visible: boolean;
  updated_at: string;
}

const FAQ_COLUMNS = "id, question, answer_html, sort, visible, updated_at";

/** Every question, hidden ones too, in the order the page shows them. */
export async function listPatronFaq(): Promise<PatronFaqRow[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("patron_faq")
    .select(FAQ_COLUMNS)
    .order("sort")
    .order("id")
    .limit(200);
  if (error) throw new Error(`[patron_faq] ${error.message}`);
  return data;
}

export async function getPatronFaqItem(id: string): Promise<PatronFaqRow | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("patron_faq")
    .select(FAQ_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`[patron_faq] ${error.message}`);
  return data;
}
