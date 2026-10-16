"use server";

import "server-only";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  failed,
  firstIssue,
  formObject,
  invalid,
  NOT_SIGNED_IN,
  signedIn,
  type Session,
} from "@/lib/actions";
import type { ActionState } from "@/lib/action-state";
import { adminRoutes } from "@/config/routes";
import { tags } from "@/lib/cache/tags";
import { iso3, slug } from "@/lib/validation/common";
import { CategoryInput, ImportInput, IndicatorInput, ValueInput } from "./schema";

/**
 * An indicator's definition (label, scale, categories) is part of the map
 * snapshot; its values are cached per indicator. A change refreshes only what
 * it touched — saving a value doesn't rebuild the snapshot every page reads.
 */
const refreshDefinitions = () => updateTag(tags.atlas);
const refreshValues = (id: string) => updateTag(tags.indicator(id));

/**
 * Creating a custom indicator or editing its description and scale. The kind (sequential /
 * categorical) and the "custom" flag don't change after creation (guard_indicators).
 */
export async function saveIndicator(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = IndicatorInput.safeParse(formObject(formData, ["ramp"]));
  if (!parsed.success) return invalid(parsed.error);
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { supabase, user } = session;
  const { is_new, id, type, ...fields } = parsed.data;
  const row = {
    ...fields,
    source_url: fields.source_url ?? null,
    domain_min: fields.domain_min ?? null,
    domain_max: fields.domain_max ?? null,
  };

  if (is_new) {
    const { error } = await supabase
      .from("indicators")
      .insert({ ...row, id, type, is_custom: true, created_by: user.id });
    if (error) return failed(error);
    refreshDefinitions();
    redirect(adminRoutes.data(id));
  }
  const { data, error } = await supabase.from("indicators").update(row).eq("id", id).select("id");
  if (error) return failed(error);
  if (!data.length) return { ok: false, error: "You can't edit this indicator." };
  refreshDefinitions();
  return { ok: true, message: "Indicator saved." };
}

export async function deleteIndicator(id: string): Promise<ActionState> {
  if (!slug(60).safeParse(id).success) return { ok: false, error: "Invalid indicator." };
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { data, error } = await session.supabase
    .from("indicators")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return failed(error);
  if (!data.length) {
    return {
      ok: false,
      error: "Only custom indicators can be deleted, and only with delete permission.",
    };
  }
  // Its values went with it (cascade).
  refreshDefinitions();
  refreshValues(id);
  return { ok: true, message: "Indicator deleted." };
}

/** Moves a data layer one place up or down (move_indicator: one transaction, RLS layers "e"). */
export async function moveIndicator(id: string, up: boolean): Promise<ActionState> {
  if (!slug(60).safeParse(id).success || typeof up !== "boolean") {
    return { ok: false, error: "Invalid indicator." };
  }
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { error } = await session.supabase.rpc("move_indicator", { p_id: id, p_up: up });
  if (error) return failed(error);
  // The order of the layer switcher, legends and country cards is in the snapshot.
  refreshDefinitions();
  return { ok: true, message: "Moved." };
}

type Client = Session["supabase"];
type DbError = Parameters<typeof failed>[0];

/** The layer's latest year (null when unknown or unreadable). */
async function latestYear(supabase: Client, id: string) {
  const { data } = await supabase
    .from("indicators")
    .select("latest_year")
    .eq("id", id)
    .maybeSingle();
  return data?.latest_year ?? null;
}

/**
 * A written or removed value refreshes its layer's values; when it moved the
 * layer's latest year (the DB recomputes it, indicator_values_latest_year),
 * the definitions in the snapshot too.
 */
async function writeValue(
  supabase: Client,
  id: string,
  write: () => PromiseLike<{ error: DbError | null; unchanged?: boolean }>,
): Promise<{ error: DbError | null }> {
  const before = await latestYear(supabase, id);
  const { error, unchanged } = await write();
  if (error || unchanged) return { error };
  refreshValues(id);
  if ((await latestYear(supabase, id)) !== before) refreshDefinitions();
  return { error: null };
}

/** Manual value (new or a correction of an imported one); the source is required. */
export async function setValue(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = ValueInput.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { year, note, ...fields } = parsed.data;
  const { error } = await writeValue(session.supabase, fields.indicator_id, () =>
    session.supabase
      .from("indicator_values")
      .upsert({ ...fields, year: year ?? null, note: note ?? null }),
  );
  if (error) return failed(error);
  return { ok: true, message: "Value saved." };
}

export async function deleteValue(indicatorId: string, country: string): Promise<ActionState> {
  if (!slug(60).safeParse(indicatorId).success || !iso3.safeParse(country).success) {
    return { ok: false, error: "Invalid value." };
  }
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  let removed = 0;
  const { error } = await writeValue(session.supabase, indicatorId, async () => {
    const result = await session.supabase
      .from("indicator_values")
      .delete()
      .eq("indicator_id", indicatorId)
      .eq("country_iso3", country)
      .select("country_iso3");
    removed = result.data?.length ?? 0;
    return result;
  });
  if (error) return failed(error);
  if (!removed) return { ok: false, error: "You can't delete this value." };
  return { ok: true, message: "Value deleted." };
}

/** What import_indicator_values() did (its jsonb result). */
interface ImportCounts {
  added: number;
  changed: number;
  unchanged: number;
  removed: number;
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * CSV import of a layer's values (the browser parsed the file and matched
 * the countries). One call to import_indicator_values(): under the caller's
 * session it upserts every row and — with `replace` — removes the countries
 * the file lacks, in one transaction. The stored rows are manual values with
 * the import's source (the DB stamps `is_manual` for every write by a team
 * member), so the seed never overwrites them.
 */
export async function importValues(input: unknown): Promise<ActionState> {
  const parsed = ImportInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { supabase } = session;
  const { indicator_id, rows, replace, source_note } = parsed.data;
  let counts: ImportCounts | null = null;
  const { error } = await writeValue(supabase, indicator_id, async () => {
    const result = await supabase.rpc("import_indicator_values", {
      p_indicator: indicator_id,
      p_rows: rows,
      p_replace: replace,
      p_source: source_note,
    });
    counts = result.data as ImportCounts | null;
    const changes = counts ? counts.added + counts.changed + counts.removed : 0;
    return { error: result.error, unchanged: !result.error && changes === 0 };
  });
  if (error) return failed(error);
  const done: ImportCounts = counts ?? { added: 0, changed: 0, unchanged: 0, removed: 0 };
  return {
    ok: true,
    message: `Import finished: ${plural(done.added, "value")} added, ${done.changed} changed, ${
      done.removed
    } removed, ${done.unchanged} already the same.`,
  };
}

/** Code list of a categorical indicator (value → label and colour). */
export async function saveCategories(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = slug(60).safeParse(formData.get("indicator_id"));
  if (!id.success) return { ok: false, error: "Invalid indicator." };
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return { ok: false, error: "Invalid data." };
  }
  const items = z
    .array(CategoryInput)
    .max(20)
    .refine((list) => new Set(list.map((c) => c.value)).size === list.length, {
      message: "Each value may appear in the category list only once.",
    })
    .safeParse(raw);
  if (!items.success) return { ok: false, error: firstIssue(items.error) };

  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { supabase } = session;
  const keep = items.data.map((item) => item.value);
  let remove = supabase.from("indicator_categories").delete().eq("indicator_id", id.data);
  if (keep.length) remove = remove.not("value", "in", `(${keep.join(",")})`);
  const { data: removed, error: removeError } = await remove.select("value");
  if (removeError) return failed(removeError);
  // An empty list that removed nothing changed nothing (RLS filters a delete
  // without an error) — no reason to rebuild the map.
  if (!keep.length && !removed.length) {
    return { ok: false, error: "Nothing changed (no categories, or you can't edit them)." };
  }
  if (keep.length) {
    const { error } = await supabase
      .from("indicator_categories")
      .upsert(items.data.map((item) => ({ ...item, indicator_id: id.data })));
    if (error) return failed(error);
  }
  refreshDefinitions();
  return { ok: true, message: "Categories saved." };
}
