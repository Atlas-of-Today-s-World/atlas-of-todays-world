"use server";

import "server-only";
import { revalidatePath, updateTag } from "next/cache";
import { adminRoutes } from "@/config/routes";
import { affected, formAction } from "@/lib/actions";
import { tags } from "@/lib/cache/tags";
import { HomeSettingsInput } from "./schema";

/**
 * The home map's entry tiles (/admin/home): how many of the newest published
 * entries it shows. RLS decides: "e" in the `news` or `site` section changes
 * it. A save refreshes the home map's count (tags.home).
 */

const NO_RIGHT = "You can't change the home page.";

/** How many tiles the home map shows (home_settings, one row). */
export const saveHomeSettings = formAction(HomeSettingsInput, async ({ data, supabase }) => {
  const denied = affected(
    await supabase.from("home_settings").update(data).eq("id", 1).select("id"),
    NO_RIGHT,
  );
  if (denied) return denied;
  updateTag(tags.home);
  revalidatePath(adminRoutes.homePage);
  return { ok: true, message: "Saved. The home map shows it within a moment." };
});
