"use server";

import "server-only";
import { revalidatePath, updateTag } from "next/cache";
import { adminRoutes } from "@/config/routes";
import { affected, failed, formAction, idAction } from "@/lib/actions";
import { tags } from "@/lib/cache/tags";
import { RedirectInput } from "./schema";

/** Adds a redirect (RLS: section news "c"; the DB enforces loops and path shape). */
export const addRedirect = formAction(RedirectInput, async ({ data, supabase }) => {
  const { error } = await supabase.from("redirects").insert(data);
  if (error) return failed(error);
  updateTag(tags.redirects);
  revalidatePath(adminRoutes.redirects);
  return { ok: true, message: `Redirect added: ${data.from_path} → ${data.to_path}` };
});

/** Deletes a redirect (RLS: section news "d"). */
export const deleteRedirect = idAction(
  async ({ id, supabase }) => {
    const denied = affected(
      await supabase.from("redirects").delete().eq("id", id).select("id"),
      "The redirect can't be deleted (no permission).",
    );
    if (denied) return denied;
    updateTag(tags.redirects);
    revalidatePath(adminRoutes.redirects);
    return { ok: true, message: "Deleted." };
  },
  { invalid: "Invalid redirect." },
);
