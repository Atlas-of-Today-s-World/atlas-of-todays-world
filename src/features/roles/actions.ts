"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { SECTIONS } from "@/features/auth/sections";
import {
  failed,
  formObject,
  invalid,
  NOT_SIGNED_IN,
  signedIn,
  type ActionState,
} from "@/lib/actions";
import { slug } from "@/lib/validation/common";
import { MatrixInput, RoleInput, SecurityInput } from "./schema";

const PAGE = "/admin/roles";

/**
 * Oprávnění jedné role (řádek matice role × sekce × vced). Admin je zamčený
 * a svou vlastní roli nikdo kromě admina nemění — hlídá guard_role_permissions.
 */
export async function saveMatrix(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const sections = Object.fromEntries(
    SECTIONS.map((section) => [section, formData.getAll(`perm:${section}`).map(String)]),
  );
  const parsed = MatrixInput.safeParse({ role_id: formData.get("role_id"), sections });
  if (!parsed.success) return invalid(parsed.error);
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { supabase } = session;
  const { role_id, sections: wanted } = parsed.data;

  const { data: current, error: readError } = await supabase
    .from("role_permissions")
    .select("section, actions")
    .eq("role_id", role_id);
  if (readError) return failed(readError);
  const have = new Map(current.map((row) => [row.section, row.actions]));

  const upserts = Object.entries(wanted)
    .filter(([section, actions]) => actions && have.get(section) !== actions)
    .map(([section, actions]) => ({ role_id, section, actions }));
  const removals = Object.entries(wanted)
    .filter(([section, actions]) => !actions && have.has(section))
    .map(([section]) => section);

  if (upserts.length) {
    const { error } = await supabase.from("role_permissions").upsert(upserts);
    if (error) return failed(error);
  }
  if (removals.length) {
    const { error } = await supabase
      .from("role_permissions")
      .delete()
      .eq("role_id", role_id)
      .in("section", removals);
    if (error) return failed(error);
  }
  revalidatePath(PAGE);
  return {
    ok: true,
    message: upserts.length || removals.length ? "Permissions saved." : "No changes.",
  };
}

export async function saveRole(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = RoleInput.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { is_new, id, ...fields } = parsed.data;
  const { error } = is_new
    ? await session.supabase.from("roles").insert({ id, ...fields, position: 80 })
    : await session.supabase.from("roles").update(fields).eq("id", id);
  if (error) return failed(error);
  revalidatePath(PAGE);
  return { ok: true, message: is_new ? "Role created." : "Role saved." };
}

export async function deleteRole(id: string): Promise<ActionState> {
  if (!slug(40).safeParse(id).success) return { ok: false, error: "Invalid role." };
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { data, error } = await session.supabase.from("roles").delete().eq("id", id).select("id");
  if (error) return failed(error);
  if (!data.length) return { ok: false, error: "You can't delete this role." };
  revalidatePath(PAGE);
  return { ok: true, message: "Role deleted." };
}

export async function saveSecurity(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = SecurityInput.safeParse(formObject(formData, ["require_2fa_roles"]));
  if (!parsed.success) return invalid(parsed.error);
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { data, error } = await session.supabase
    .from("security_settings")
    .update(parsed.data)
    .eq("id", 1)
    .select("id");
  if (error) return failed(error);
  if (!data.length) return { ok: false, error: "You can't change the security settings." };
  revalidatePath(PAGE);
  return { ok: true, message: "Settings saved." };
}
