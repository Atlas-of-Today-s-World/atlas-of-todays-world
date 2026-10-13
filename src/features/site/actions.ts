"use server";

import "server-only";
import { revalidatePath, updateTag } from "next/cache";
import { adminRoutes } from "@/config/routes";
import {
  affected,
  failed,
  formAction,
  formObject,
  idAction,
  invalid,
  NOT_SIGNED_IN,
  signedIn,
  type ActionState,
} from "@/lib/actions";
import { tags } from "@/lib/cache/tags";
import { SettingsInput, SocialId, SocialInput } from "./schema";

/**
 * Site settings and social links (Admin → Site settings). Every write goes
 * through the session client, so RLS decides (section `site`: e for the
 * settings, c/e/d for the links); then the `site` tag refreshes every page
 * that shows them (header, footer, structured data, feeds, llms.txt…).
 */

function refreshed(message: string): ActionState {
  updateTag(tags.site);
  revalidatePath(adminRoutes.siteSettings, "layout");
  return { ok: true, message };
}

/** The settings row (RLS: site "e"; the row always exists, id = 1). */
export const saveSiteSettings = formAction(SettingsInput, async ({ data, supabase }) => {
  const denied = affected(
    await supabase.from("site_settings").update(data).eq("id", 1).select("id"),
    "You can't change the site settings.",
  );
  if (denied) return denied;
  return refreshed("Saved. The site shows the change within a moment.");
});

/** A new social link, added at the end (RLS: site "c"). */
export const addSocialLink = formAction(SocialInput, async ({ data, supabase }) => {
  const last = await supabase
    .from("site_social_links")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (last.error) return failed(last.error);
  const { error } = await supabase
    .from("site_social_links")
    .insert({ ...data, position: (last.data?.position ?? -1) + 1 });
  if (error) return failed(error);
  return refreshed(`Added: ${data.label}`);
});

/** Changes a social link (RLS: site "e"); bound to the link's id in the form. */
export async function updateSocialLink(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!SocialId.safeParse(id).success) return { ok: false, error: "Invalid social link." };
  const parsed = SocialInput.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const denied = affected(
    await session.supabase.from("site_social_links").update(parsed.data).eq("id", id).select("id"),
    "The link can't be changed (no permission).",
  );
  if (denied) return denied;
  return refreshed("Saved.");
}

/** Deletes a social link (RLS: site "d"). */
export const deleteSocialLink = idAction(
  async ({ id, supabase }) => {
    const denied = affected(
      await supabase.from("site_social_links").delete().eq("id", id).select("id"),
      "The link can't be deleted (no permission).",
    );
    if (denied) return denied;
    return refreshed("Deleted.");
  },
  { invalid: "Invalid social link." },
);

/** Swaps a link with its neighbour (RPC move_site_social_link; site "e"). */
export async function moveSocialLink(id: string, up: boolean): Promise<ActionState> {
  if (!SocialId.safeParse(id).success || typeof up !== "boolean") {
    return { ok: false, error: "Invalid social link." };
  }
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { error } = await session.supabase.rpc("move_site_social_link", { p_id: id, p_up: up });
  if (error) return failed(error);
  return refreshed("Moved.");
}
