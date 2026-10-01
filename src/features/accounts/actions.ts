"use server";

import "server-only";
import {
  failed,
  formObject,
  invalid,
  NOT_SIGNED_IN,
  signedIn,
  type ActionState,
} from "@/lib/actions";
import { serverEnv } from "@/lib/env.server";
import { createServiceClient } from "@/lib/supabase/service";
import { AccountInput } from "./schema";

type Client = NonNullable<Awaited<ReturnType<typeof signedIn>>>["supabase"];

/** Vyrovná přiřazení (země / autoři) na požadovaný seznam. */
async function syncAssignments(
  supabase: Client,
  table: "approver_countries" | "approver_authors",
  column: "country_iso3" | "author_id",
  userId: string,
  want: string[],
): Promise<ActionState | null> {
  // Obě tabulky mají tvar (user_id, <column>); typy Supabase to jednou funkcí neumí vyjádřit.
  const from = () => supabase.from(table as "approver_countries");
  const key = column as "country_iso3";
  const { data, error } = await from().select(key).eq("user_id", userId);
  if (error) return failed(error);
  const have = new Set(data.map((row) => row[key]));
  const target = new Set(want);
  const remove = [...have].filter((value) => !target.has(value));
  const add = [...target].filter((value) => !have.has(value));
  if (remove.length) {
    const { error: removeError } = await from().delete().eq("user_id", userId).in(key, remove);
    if (removeError) return failed(removeError);
  }
  if (add.length) {
    const rows = add.map((value) => ({ user_id: userId, [column]: value }));
    const { error: addError } = await from().insert(
      rows as unknown as { user_id: string; country_iso3: string }[],
    );
    if (addError) return failed(addError);
  }
  return null;
}

/**
 * Úprava účtu (ARCHITEKTURA 7, E6): role, blokace, přiřazení schvalovatele.
 * Co kdo smí, hlídá guard_profiles + RLS; zablokovaný účet se navíc
 * zablokuje i v Supabase Auth, aby mu hned přestala platit session (DB-18).
 */
export async function saveAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = AccountInput.safeParse(formObject(formData, ["countries", "authors"]));
  if (!parsed.success) return invalid(parsed.error);
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { supabase } = session;
  const { id, countries, authors, blocked_note, ...fields } = parsed.data;

  const { data: before, error: readError } = await supabase
    .from("profiles")
    .select("status, approval_global")
    .eq("id", id)
    .single();
  if (readError) return failed(readError);

  const update: {
    role_id: string;
    kind: string;
    status: string;
    blocked_note: string | null;
    approval_global?: boolean;
  } = {
    role_id: fields.role_id,
    kind: fields.role_id === "reader" ? "reader" : "staff",
    status: fields.status,
    blocked_note: fields.status === "blocked" ? (blocked_note ?? null) : null,
  };
  // Globální schvalovatele určuje jen admin — neposílat, když se nemění.
  if (fields.approval_global !== before.approval_global) {
    update.approval_global = fields.approval_global;
  }
  const { data, error } = await supabase.from("profiles").update(update).eq("id", id).select("id");
  if (error) return failed(error);
  if (!data.length) return { ok: false, error: "You can't edit this account." };

  for (const [table, column, want] of [
    ["approver_countries", "country_iso3", countries],
    ["approver_authors", "author_id", authors],
  ] as const) {
    const problem = await syncAssignments(supabase, table, column, id, want);
    if (problem) return problem;
  }

  if (before.status !== fields.status && serverEnv.SUPABASE_SERVICE_ROLE_KEY) {
    // Profil se změnil pod RLS (oprávnění ověřena); ban v Auth umí jen servisní klíč.
    const { error: banError } = await createServiceClient().auth.admin.updateUserById(id, {
      ban_duration: fields.status === "blocked" ? "876000h" : "none",
    });
    if (banError) {
      console.error("[accounts] ban failed", banError.message);
      return {
        ok: false,
        error: "The account status is saved, but sign-in couldn't be blocked. Try again.",
      };
    }
  }
  return { ok: true, message: "Account saved." };
}
