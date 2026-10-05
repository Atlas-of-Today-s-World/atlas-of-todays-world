"use server";

import "server-only";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  failed,
  formObject,
  jsonField,
  invalid,
  listItemError,
  NOT_SIGNED_IN,
  signedIn,
  type ActionState,
} from "@/lib/actions";
import { tags } from "@/lib/cache/tags";
import { requiredText, uuid } from "@/lib/validation/common";
import { TemplateInput, TILE_FIELD_LABEL, TilesInput } from "./schema";

const TEMPLATES = "/admin/topic-templates";

/**
 * A topic template: its name, section labels and tiles, saved at once. A new
 * template opens its own page afterwards. RLS: the right over all articles.
 */
export async function saveTemplate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = TemplateInput.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const tiles = TilesInput.safeParse(jsonField(formData, "tiles"));
  if (!tiles.success) return listItemError(tiles.error, "Tile", TILE_FIELD_LABEL);

  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { id, ...fields } = parsed.data;
  const { data, error } = id
    ? await session.supabase.from("topic_templates").update(fields).eq("id", id).select("id")
    : await session.supabase.from("topic_templates").insert(fields).select("id");
  if (error) return failed(error);
  const saved = data[0];
  if (!saved) return { ok: false, error: "You can't change templates." };
  const { error: tileError } = await session.supabase.rpc("replace_tiles", {
    p_entry: null,
    p_template: saved.id,
    p_items: tiles.data.map(({ id: tileId, ...tile }) => {
      void tileId;
      return tile;
    }),
  });
  if (tileError) return failed(tileError);
  revalidatePath(TEMPLATES);
  if (!id) redirect(`${TEMPLATES}/${saved.id}?saved=1`);
  return { ok: true, message: "Template saved." };
}

/** Makes a template the default for new topics. */
export async function setDefaultTemplate(id: string): Promise<ActionState> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Invalid template." };
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { error } = await session.supabase.rpc("set_default_topic_template", { p_template: id });
  if (error) return failed(error);
  revalidatePath(TEMPLATES);
  return { ok: true, message: "New topics now start from this template." };
}

/** Deletes a template (never the default); topics made from it keep their tiles. */
export async function deleteTemplate(id: string): Promise<ActionState> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Invalid template." };
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { data, error } = await session.supabase
    .from("topic_templates")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return failed(error);
  if (!data.length) return { ok: false, error: "The default template can't be deleted." };
  revalidatePath(TEMPLATES);
  return { ok: true, message: "Template deleted." };
}

const ApplyInput = z.object({
  entry_id: uuid,
  template_id: uuid,
  remove_missing: z.preprocess((value) => value === "on", z.boolean()),
});

/**
 * Re-applies a template to a topic: tiles with the same address take the
 * template's look and keep their links; missing ones are added; with
 * `remove_missing` the topic's other tiles go (with their links).
 */
export async function applyTemplate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = ApplyInput.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { entry_id, template_id, remove_missing } = parsed.data;
  const { error } = await session.supabase.rpc("apply_topic_template", {
    p_entry: entry_id,
    p_template: template_id,
    p_remove_missing: remove_missing,
  });
  if (error) return failed(error);
  const { data } = await session.supabase
    .from("entries")
    .select("slug, status")
    .eq("id", entry_id)
    .maybeSingle();
  if (data?.status === "published") {
    updateTag(tags.entries);
    updateTag(tags.entry(data.slug));
  }
  revalidatePath(`/admin/content/${entry_id}`);
  return { ok: true, message: "Template applied." };
}

const SaveAsInput = z.object({ entry_id: uuid, name: requiredText(80) });

/** Saves a topic's tiles and labels as a new template. */
export async function saveTopicAsTemplate(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = SaveAsInput.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { error } = await session.supabase.rpc("save_topic_as_template", {
    p_entry: parsed.data.entry_id,
    p_name: parsed.data.name,
  });
  if (error) return failed(error);
  revalidatePath(TEMPLATES);
  return { ok: true, message: `Saved as template “${parsed.data.name}”.` };
}
