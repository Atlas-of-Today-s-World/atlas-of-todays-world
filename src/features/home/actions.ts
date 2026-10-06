"use server";

import "server-only";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import {
  failed,
  formObject,
  invalid,
  NOT_SIGNED_IN,
  signedIn,
  type ActionState,
} from "@/lib/actions";
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
export async function saveHomeFeatured(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = Input.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { data, error } = await session.supabase
    .from("home_featured")
    .update({
      first_chapter: parsed.data.first_chapter || null,
      second_chapter: parsed.data.second_chapter || null,
    })
    .eq("id", 1)
    .select("id");
  if (error) return failed(error);
  if (!data.length) return { ok: false, error: "You can't change the home page." };
  updateTag(tags.entries);
  revalidatePath("/admin/home");
  return { ok: true, message: "Saved. The home map shows them within a moment." };
}
