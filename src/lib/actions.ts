import "server-only";
import type { User } from "@supabase/supabase-js";
import type { ZodError } from "zod";
import { mapDbError } from "@/lib/db/errors";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Výsledek Server Action pro `useActionState` (ARCHITEKTURA 4.3): hláška
 * pro uživatele, chyby u polí ze Zod a volitelně id nově vzniklého záznamu.
 */
export interface ActionState {
  ok: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  id?: string;
}

type Client = Awaited<ReturnType<typeof createServerClient>>;

/** Klient se session a ověřený uživatel (getUser, ne getSession); null = nepřihlášen. */
export async function signedIn(): Promise<{ supabase: Client; user: User } | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, user } : null;
}

export const NOT_SIGNED_IN: ActionState = { ok: false, error: "Přihlaste se prosím znovu." };

export function invalid(error: ZodError): ActionState {
  return {
    ok: false,
    error: "Zkontrolujte zvýrazněná pole.",
    fieldErrors: error.flatten().fieldErrors as ActionState["fieldErrors"],
  };
}

export function failed(error: { code?: string; message?: string }): ActionState {
  return { ok: false, error: mapDbError(error) };
}

/** Pole z FormData jako prostý objekt (opakovaná pole jako pole hodnot). */
export function formObject(formData: FormData, arrays: string[] = []): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of new Set(formData.keys())) {
    if (key.startsWith("$")) continue; // interní pole Reactu
    out[key] = arrays.includes(key) ? formData.getAll(key) : formData.get(key);
  }
  for (const key of arrays) out[key] ??= [];
  return out;
}

/**
 * První chyba seznamu položek jako „Kapitola 2, Titulek: …" (formuláře, které
 * posílají pole položek — kapitoly, zdroje, sekce portrétu).
 */
export function listItemError(
  error: ZodError,
  item: string,
  labels: Record<string, string>,
): ActionState {
  const issue = error.issues[0];
  if (!issue) return { ok: false, error: "Zkontrolujte zvýrazněná pole." };
  const [index, field] = issue.path;
  return {
    ok: false,
    error:
      typeof index === "number"
        ? `${item} ${index + 1}, ${labels[String(field)] ?? String(field)}: ${issue.message}`
        : issue.message,
  };
}

/** Text první chyby validace (krátké formuláře s jedním polem). */
export const firstIssue = (error: ZodError) =>
  error.issues[0]?.message ?? "Zkontrolujte zvýrazněná pole.";
