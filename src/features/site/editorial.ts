import "server-only";
import type { Tables } from "@/lib/db/types.gen";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Site settings and social links — admin reads (layer: features/<domain>/editorial.ts).
 * Under the session, no cache: the team with `site` "v" also sees hidden links.
 */

export type SettingsRecord = Tables<"site_settings">;
export type SocialRecord = Pick<
  Tables<"site_social_links">,
  "id" | "label" | "url" | "icon" | "position" | "visible" | "updated_at"
>;

/** The settings row; null when it is missing (the form then starts from the built-in values). */
export async function getSettingsRecord(): Promise<SettingsRecord | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("site_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(`[site] ${error.message}`);
  return data;
}

/** Every social link in the order the site shows them. */
export async function listSocialLinks(): Promise<SocialRecord[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("site_social_links")
    .select("id, label, url, icon, position, visible, updated_at")
    .order("position")
    .order("created_at")
    .order("id");
  if (error) throw new Error(`[site] ${error.message}`);
  return data;
}

export async function getSocialLink(id: string): Promise<SocialRecord | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("site_social_links")
    .select("id, label, url, icon, position, visible, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`[site] ${error.message}`);
  return data;
}
