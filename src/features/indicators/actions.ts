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
  type ActionState,
} from "@/lib/actions";
import { tags } from "@/lib/cache/tags";
import { iso3, slug } from "@/lib/validation/common";
import { CategoryInput, IndicatorInput, ValueInput } from "./schema";

/** Indicators are part of the map snapshot — every change refreshes it. */
const refresh = () => updateTag(tags.atlas);

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
    refresh();
    redirect(`/admin/data/${id}`);
  }
  const { data, error } = await supabase.from("indicators").update(row).eq("id", id).select("id");
  if (error) return failed(error);
  if (!data.length) return { ok: false, error: "You can't edit this indicator." };
  refresh();
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
  refresh();
  return { ok: true, message: "Indicator deleted." };
}

/** Manual value (new or a correction of an imported one); the source is required. */
export async function setValue(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = ValueInput.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { year, note, ...fields } = parsed.data;
  const { error } = await session.supabase
    .from("indicator_values")
    .upsert({ ...fields, year: year ?? null, note: note ?? null });
  if (error) return failed(error);
  refresh();
  return { ok: true, message: "Value saved." };
}

export async function deleteValue(indicatorId: string, country: string): Promise<ActionState> {
  if (!slug(60).safeParse(indicatorId).success || !iso3.safeParse(country).success) {
    return { ok: false, error: "Invalid value." };
  }
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { data, error } = await session.supabase
    .from("indicator_values")
    .delete()
    .eq("indicator_id", indicatorId)
    .eq("country_iso3", country)
    .select("country_iso3");
  if (error) return failed(error);
  if (!data.length) return { ok: false, error: "You can't delete this value." };
  refresh();
  return { ok: true, message: "Value deleted." };
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
  const { error: removeError } = await remove;
  if (removeError) return failed(removeError);
  if (keep.length) {
    const { error } = await supabase
      .from("indicator_categories")
      .upsert(items.data.map((item) => ({ ...item, indicator_id: id.data })));
    if (error) return failed(error);
  }
  refresh();
  return { ok: true, message: "Categories saved." };
}
