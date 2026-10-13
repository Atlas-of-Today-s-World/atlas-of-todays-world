"use server";

import "server-only";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { adminRoutes } from "@/config/routes";
import { affected, formAction } from "@/lib/actions";
import { tags } from "@/lib/cache/tags";
import { uuid } from "@/lib/validation/common";

/** Empty = the newest subtopic fills the slot. */
const Slot = z.union([z.literal(""), uuid]);
const Input = z
  .object({ first_chapter: Slot, second_chapter: Slot })
  .refine((data) => !data.first_chapter || data.first_chapter !== data.second_chapter, {
    message: "Pick two different subtopics.",
    path: ["second_chapter"],
  });

/** Subtopics pinned on the home map (home_featured; RLS: news "e"). */
export const saveHomeFeatured = formAction(Input, async ({ data, supabase }) => {
  const denied = affected(
    await supabase
      .from("home_featured")
      .update({
        first_chapter: data.first_chapter || null,
        second_chapter: data.second_chapter || null,
      })
      .eq("id", 1)
      .select("id"),
    "You can't change the home page.",
  );
  if (denied) return denied;
  updateTag(tags.entries);
  revalidatePath(adminRoutes.homePage);
  return { ok: true, message: "Saved. The home map shows them within a moment." };
});
