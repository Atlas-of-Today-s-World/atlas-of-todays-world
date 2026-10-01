"use server";

import "server-only";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import {
  failed,
  formObject,
  invalid,
  NOT_SIGNED_IN,
  signedIn,
  type ActionState,
} from "@/lib/actions";
import { tags } from "@/lib/cache/tags";
import { slug } from "@/lib/validation/common";
import { AreaInput, ThemeInput } from "./schema";

/** Vzhled mapy: sytost barev a síla hranic (site_theme, sekce appearance). */
export async function saveTheme(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = ThemeInput.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { data, error } = await session.supabase
    .from("site_theme")
    .update(parsed.data)
    .eq("id", 1)
    .select("id");
  if (error) return failed(error);
  if (!data.length) return { ok: false, error: "You can't change the appearance." };
  updateTag(tags.atlas);
  return { ok: true, message: "Appearance saved. The map will update on the next load." };
}

/** Vlastní plocha na mapě (map_areas, sekce areas). */
export async function saveArea(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = AreaInput.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { supabase, user } = session;
  const { original_slug, country_iso3, ...fields } = parsed.data;
  const row = { ...fields, country_iso3: country_iso3 ?? null };
  const { error } = original_slug
    ? await supabase.from("map_areas").update(row).eq("slug", original_slug)
    : await supabase.from("map_areas").insert({ ...row, created_by: user.id });
  if (error) return failed(error);
  updateTag(tags.atlas);
  if (original_slug !== fields.slug) redirect(`/admin/areas/${fields.slug}`);
  return { ok: true, message: "Area saved." };
}

export async function deleteArea(areaSlug: string): Promise<ActionState> {
  if (!slug(120).safeParse(areaSlug).success) return { ok: false, error: "Invalid area." };
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { data, error } = await session.supabase
    .from("map_areas")
    .delete()
    .eq("slug", areaSlug)
    .select("slug");
  if (error) return failed(error);
  if (!data.length) return { ok: false, error: "You can't delete this area." };
  updateTag(tags.atlas);
  return { ok: true, message: "Area deleted." };
}
