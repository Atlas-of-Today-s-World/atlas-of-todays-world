"use server";

import "server-only";
import { revalidatePath, updateTag } from "next/cache";
import { affected, failed, formAction, idAction } from "@/lib/actions";
import type { ActionState } from "@/lib/action-state";
import { tags } from "@/lib/cache/tags";
import type { Json } from "@/lib/db/types.gen";
import type { ServerClient } from "@/lib/supabase/server";
import { adminRoutes } from "@/config/routes";
import { refreshEntry } from "@/features/entries/revalidate";
import type { VisualOwnerKind } from "./constants";
import { OWNER_COLUMN } from "./editorial";
import { VisualInput } from "./schema";

/**
 * Maps & charts of a region, global issue, topic or subtopic: add or change
 * one, remove one, move one up or down. RLS decides who may (the owner's
 * editors, migration 20261015000100); a write it filters out comes back
 * empty and the user gets a message instead.
 */

const OWNER_COLUMNS = "owner_kind, region_slug, special_slug, entry_id, chapter_id";

interface OwnerRow {
  owner_kind: string;
  region_slug: string | null;
  special_slug: string | null;
  entry_id: string | null;
  chapter_id: string | null;
}

const ownerOf = (row: OwnerRow) => ({
  kind: row.owner_kind as VisualOwnerKind,
  key: (row.region_slug ?? row.special_slug ?? row.entry_id ?? row.chapter_id)!,
});

/**
 * After a change: the owner's cached public page (a region's portrait also
 * shows under each of its countries; a topic's page only when it is live) and
 * its admin page.
 */
async function refreshOwner(
  supabase: ServerClient,
  { kind, key }: { kind: VisualOwnerKind; key: string },
) {
  switch (kind) {
    case "region":
      updateTag(tags.portrait("region", key));
      revalidatePath(adminRoutes.regions(key));
      return;
    case "issue":
      updateTag(tags.portrait("issue", key));
      revalidatePath(adminRoutes.globalIssues(key));
      return;
    case "entry":
      await refreshEntry(supabase, key, true);
      revalidatePath(adminRoutes.content(key));
      return;
    case "chapter": {
      const { data } = await supabase
        .from("entry_chapters")
        .select("entry_id")
        .eq("id", key)
        .maybeSingle();
      if (!data) return;
      await refreshEntry(supabase, data.entry_id, true);
      revalidatePath(adminRoutes.content(data.entry_id));
    }
  }
}

/** Adds a visual at the end of its owner's list, or changes one (`id`). */
export const saveVisual = formAction(VisualInput, async ({ data, supabase }) => {
  const { id, owner, visual } = data;
  const column = OWNER_COLUMN[owner.kind];
  const row = { ...visual, map_spec: visual.map_spec as Json | null };
  if (id) {
    const denied = affected(
      await supabase.from("visuals").update(row).eq("id", id).eq(column, owner.key).select("id"),
      "You can't edit this map or chart.",
    );
    if (denied) return denied;
  } else {
    const { data: last, error: readError } = await supabase
      .from("visuals")
      .select("position")
      .eq(column, owner.key)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (readError) return failed(readError);
    const denied = affected(
      await supabase
        .from("visuals")
        .insert({
          ...row,
          owner_kind: owner.kind,
          region_slug: owner.kind === "region" ? owner.key : null,
          special_slug: owner.kind === "issue" ? owner.key : null,
          entry_id: owner.kind === "entry" ? owner.key : null,
          chapter_id: owner.kind === "chapter" ? owner.key : null,
          position: (last?.position ?? 0) + 10,
        })
        .select("id"),
      "You can't add maps and charts here.",
    );
    if (denied) return denied;
  }
  await refreshOwner(supabase, owner);
  return { ok: true, message: id ? "Saved." : "Added." };
});

export const deleteVisual = idAction(
  async ({ id, supabase }): Promise<ActionState> => {
    const result = await supabase.from("visuals").delete().eq("id", id).select(OWNER_COLUMNS);
    const denied = affected(result, "You can't remove this map or chart.");
    if (denied) return denied;
    await refreshOwner(supabase, ownerOf(result.data![0]!));
    return { ok: true, message: "Removed." };
  },
  { invalid: "Invalid map or chart." },
);

/** One place up or down among its owner's visuals (move_visual: the update policy decides). */
export const moveVisual = idAction(
  async ({ id, supabase }, up: boolean): Promise<ActionState> => {
    if (typeof up !== "boolean") return { ok: false, error: "Invalid move." };
    const { error } = await supabase.rpc("move_visual", { p_id: id, p_up: up });
    if (error) return failed(error);
    const { data } = await supabase
      .from("visuals")
      .select(OWNER_COLUMNS)
      .eq("id", id)
      .maybeSingle();
    if (data) await refreshOwner(supabase, ownerOf(data));
    return { ok: true, message: "Moved." };
  },
  { invalid: "Invalid map or chart." },
);
