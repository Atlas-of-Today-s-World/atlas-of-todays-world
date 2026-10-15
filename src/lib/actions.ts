import "server-only";
import type { User } from "@supabase/supabase-js";
import type { ZodError, ZodType } from "zod";
import { mapDbError } from "@/lib/db/errors";
import { createServerClient, type ServerClient } from "@/lib/supabase/server";
import { uuid } from "@/lib/validation/common";
import type { ActionState } from "@/lib/action-state";

/** Client with a session and the verified user (getUser, not getSession); null = signed out. */
export async function signedIn(): Promise<{ supabase: ServerClient; user: User } | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, user } : null;
}

export const NOT_SIGNED_IN: ActionState = { ok: false, error: "Please sign in again." };

export function invalid(error: ZodError): ActionState {
  return {
    ok: false,
    error: "Please check the highlighted fields.",
    fieldErrors: error.flatten().fieldErrors as ActionState["fieldErrors"],
  };
}

/**
 * Public forms whose Zod messages are message codes (the form picks the text in
 * the page language): the first code as the error, every code under its field.
 */
export function invalidCodes(error: ZodError): ActionState {
  return {
    ok: false,
    error: firstIssue(error),
    fieldErrors: error.flatten().fieldErrors as ActionState["fieldErrors"],
  };
}

export function failed(error: { code?: string; message?: string }): ActionState {
  return { ok: false, error: mapDbError(error) };
}

/** Field names that would reach the object's prototype instead of a field. */
const PROTOTYPE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/** FormData fields as a plain object (repeated fields as arrays of values). */
export function formObject(formData: FormData, arrays: string[] = []): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of new Set(formData.keys())) {
    if (key.startsWith("$")) continue; // React internal field
    if (PROTOTYPE_KEYS.has(key)) continue;
    out[key] = arrays.includes(key) ? formData.getAll(key) : formData.get(key);
  }
  for (const key of arrays) out[key] ??= [];
  return out;
}

/** Reads a JSON list posted in a hidden field; null when it isn't valid JSON. */
export function jsonField(formData: FormData, name: string): unknown {
  try {
    return JSON.parse(String(formData.get(name) ?? "[]"));
  } catch {
    return null;
  }
}

/**
 * First error of an item list as "Chapter 2, Title: …" (forms that submit
 * arrays of items — chapters, sources, portrait sections).
 */
export function listItemError(
  error: ZodError,
  item: string,
  labels: Record<string, string>,
): ActionState {
  const issue = error.issues[0];
  if (!issue) return { ok: false, error: "Please check the highlighted fields." };
  const [index, field] = issue.path;
  return {
    ok: false,
    error:
      typeof index === "number"
        ? `${item} ${index + 1}, ${labels[String(field)] ?? String(field)}: ${issue.message}`
        : issue.message,
  };
}

/** Text of the first validation error (short single-field forms). */
export const firstIssue = (error: ZodError) =>
  error.issues[0]?.message ?? "Please check the highlighted fields.";

/*
 * Server Action wrappers — the fixed steps of ARCHITEKTURA 4.3 (Zod → getUser →
 * write under RLS → mapDbError) in one place, so an action holds only its own
 * write and revalidation. In a "use server" module export the wrapped function
 * as a const (Next accepts it: the export is still an async function):
 *
 *   export const saveThing = formAction(ThingInput, async ({ data, supabase }) => {
 *     const denied = affected(
 *       await supabase.from("things").update(data).eq("id", data.id).select("id"),
 *       "You can't edit this thing.",
 *     );
 *     if (denied) return denied;
 *     revalidatePath(adminRoutes.things.list);
 *     return { ok: true, message: "Saved." };
 *   });
 *
 *   export const deleteThing = idAction(
 *     async ({ id, supabase }) => { … },
 *     { invalid: "Invalid thing." },
 *   );
 *
 * The form side: `useServerAction(saveThing)` (components/admin/ActionForm) or
 * `useActionState(saveThing, { ok: false })`; a row button binds the id:
 * `deleteThing.bind(null, row.id)`.
 */

/** The signed-in user's session client and the verified user, as `signedIn()` returns them. */
export interface Session {
  supabase: ServerClient;
  user: User;
}

/**
 * A form action for `useActionState`: reads the FormData (`arrays`: fields
 * posted repeatedly, see `formObject`), validates it with `schema` (failure →
 * `invalid`, field errors under the fields), requires a signed-in user
 * (`NOT_SIGNED_IN`), then runs `handler` with the parsed data and the session.
 */
export function formAction<T>(
  schema: ZodType<T>,
  handler: (input: Session & { data: T; formData: FormData }) => Promise<ActionState>,
  opts: { arrays?: string[] } = {},
): (prev: ActionState, formData: FormData) => Promise<ActionState> {
  return async (_prev, formData) => {
    const parsed = schema.safeParse(formObject(formData, opts.arrays));
    if (!parsed.success) return invalid(parsed.error);
    const session = await signedIn();
    if (!session) return NOT_SIGNED_IN;
    return handler({ ...session, data: parsed.data, formData });
  };
}

/**
 * An action on one record by its uuid (row buttons: delete, revoke…): a value
 * that isn't a uuid → `{ ok: false, error: opts.invalid }`, signed out →
 * `NOT_SIGNED_IN`, otherwise `handler` with the id, the session and any further
 * arguments the caller passed.
 */
export function idAction<A extends unknown[]>(
  handler: (input: Session & { id: string }, ...args: A) => Promise<ActionState>,
  opts: { invalid?: string } = {},
): (id: string, ...args: A) => Promise<ActionState> {
  return async (id, ...args) => {
    if (!uuid.safeParse(id).success) return { ok: false, error: opts.invalid ?? "Invalid record." };
    const session = await signedIn();
    if (!session) return NOT_SIGNED_IN;
    return handler({ ...session, id }, ...args);
  };
}

/**
 * Checks a write that ends with `.select(…)`: RLS filters the rows a user may
 * not touch without an error, so no returned row means "not allowed" (or the
 * record is gone) and the user gets `message`. Given the whole result
 * (`{ data, error }`) a database error becomes `failed(error)` too.
 * null = the write went through.
 */
export function affected(
  result: WriteResult | WriteResult["data"],
  message: string,
): ActionState | null {
  if (result && "error" in result) {
    return result.error ? failed(result.error) : affected(result.data, message);
  }
  return result?.length ? null : { ok: false, error: message };
}

interface WriteResult {
  data: readonly unknown[] | null;
  error: Parameters<typeof failed>[0] | null;
}
