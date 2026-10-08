import "server-only";
import type { User } from "@supabase/supabase-js";
import type { ZodError } from "zod";
import { mapDbError } from "@/lib/db/errors";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Server Action result for `useActionState` (ARCHITEKTURA 4.3): a message for
 * the user, Zod field errors and optionally the id of the newly created record.
 */
export interface ActionState {
  ok: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  id?: string;
  /** Preview images the server found for saved links ({ link → image }), for the editor to show. */
  previews?: Record<string, string>;
}

type Client = Awaited<ReturnType<typeof createServerClient>>;

/** Client with a session and the verified user (getUser, not getSession); null = signed out. */
export async function signedIn(): Promise<{ supabase: Client; user: User } | null> {
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
