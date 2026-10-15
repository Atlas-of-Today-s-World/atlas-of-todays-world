"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { adminRoutes } from "@/config/routes";
import { SECTIONS } from "@/features/auth/sections";
import {
  affected,
  failed,
  formAction,
  formObject,
  invalid,
  NOT_SIGNED_IN,
  signedIn,
  type ActionState,
} from "@/lib/actions";
import { slug } from "@/lib/validation/common";
import { MatrixInput, RoleInput, SecurityInput } from "./schema";

const PAGE = adminRoutes.roles;

/**
 * Permissions of one role (a row of the role × section × vced matrix). Admin is
 * locked and nobody but an admin changes their own role — enforced by guard_role_permissions.
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

/**
 * Creates a role (at the end of the role order) or saves its name, note and
 * scopes. RLS (permissions "c" / "e") filters a role the user may not change
 * without an error, so an update that touched no row is reported.
 */
export const saveRole = formAction(RoleInput, async ({ data, supabase }) => {
  const { is_new, id, ...fields } = data;
  if (is_new) {
    const last = await supabase
      .from("roles")
      .select("position")
      .neq("id", "reader")
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (last.error) return failed(last.error);
    const { error } = await supabase
      .from("roles")
      .insert({ id, ...fields, position: (last.data?.position ?? 0) + 10 });
    if (error) return failed(error);
  } else {
    const denied = affected(
      await supabase.from("roles").update(fields).eq("id", id).select("id"),
      "You can't edit this role.",
    );
    if (denied) return denied;
  }
  revalidatePath(PAGE);
  return { ok: true, message: is_new ? "Role created." : "Role saved." };
});

/** Swaps a role with its neighbour in the menu order (RPC move_role; permissions "e"). */
export async function moveRole(id: string, up: boolean): Promise<ActionState> {
  if (!slug(40).safeParse(id).success || typeof up !== "boolean") {
    return { ok: false, error: "Invalid role." };
  }
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { error } = await session.supabase.rpc("move_role", { p_id: id, p_up: up });
  if (error) return failed(error);
  revalidatePath(PAGE);
  return { ok: true, message: "Moved." };
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
