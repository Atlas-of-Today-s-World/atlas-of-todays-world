"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import {
  failed,
  formObject,
  invalid,
  invalidCodes,
  NOT_SIGNED_IN,
  signedIn,
  type ActionState,
} from "@/lib/actions";
import { serverEnv } from "@/lib/env.server";
import { allowRequest } from "@/lib/security/rate-limit";
import { createServiceClient } from "@/lib/supabase/service";
import { uuid } from "@/lib/validation/common";
import { APPLICATION_STATUSES, ApplicationInput, SettingsInput } from "./schema";

const ADMIN_PAGE = "/admin/volunteers";

/**
 * A visitor applies to edit content as a volunteer (/membership). Results are
 * codes (messages: patrons.volunteer.messages). Honeypot `website`, a shared
 * per-IP rate limit, then the DB function (which also caps applications per
 * hour). The e-mail to the address set in the admin is sent later (not yet).
 */
export async function applyAsVolunteer(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (String(formData.get("website") ?? "").trim()) return { ok: true, message: "thanks" };
  if (!(await allowRequest("volunteer", await headers(), { limit: 3, windowSeconds: 3600 }))) {
    return { ok: false, error: "rateLimited" };
  }
  const parsed = ApplicationInput.safeParse({
    name: formData.get("name") ?? "",
    email: formData.get("email") ?? "",
    topics: formData.get("topics") ?? "",
    message: formData.get("message") ?? "",
    consent: formData.get("consent"),
  });
  if (!parsed.success) return invalidCodes(parsed.error);
  // Only the server may submit (after the per-IP limit above); the RPC is not public.
  if (!serverEnv.SUPABASE_SERVICE_ROLE_KEY) return { ok: false, error: "failed" };
  const { error } = await createServiceClient().rpc("submit_volunteer_application", {
    p_name: parsed.data.name,
    p_email: parsed.data.email,
    p_topics: parsed.data.topics,
    p_message: parsed.data.message,
  });
  if (error)
    return { ok: false, error: /rate_limited/.test(error.message) ? "rateLimited" : "failed" };
  return { ok: true, message: "thanks" };
}

/** Where applications are sent (volunteer_settings; RLS: accounts "e"). */
export async function saveVolunteerSettings(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = SettingsInput.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { data, error } = await session.supabase
    .from("volunteer_settings")
    .update({ notify_email: parsed.data.notify_email || null })
    .eq("id", 1)
    .select("id");
  if (error) return failed(error);
  if (!data.length) return { ok: false, error: "You can't change where applications go." };
  revalidatePath(ADMIN_PAGE);
  return { ok: true, message: "Saved." };
}

const Status = z.enum(APPLICATION_STATUSES);

export async function setApplicationStatus(id: string, status: string): Promise<ActionState> {
  if (!uuid.safeParse(id).success || !Status.safeParse(status).success) {
    return { ok: false, error: "Invalid application." };
  }
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { data, error } = await session.supabase
    .from("volunteer_applications")
    .update({ status })
    .eq("id", id)
    .select("id");
  if (error) return failed(error);
  if (!data.length) return { ok: false, error: "You can't change applications." };
  revalidatePath(ADMIN_PAGE);
  return { ok: true, message: "Updated." };
}

export async function deleteApplication(id: string): Promise<ActionState> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Invalid application." };
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { data, error } = await session.supabase
    .from("volunteer_applications")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return failed(error);
  if (!data.length) return { ok: false, error: "You can't delete applications." };
  revalidatePath(ADMIN_PAGE);
  return { ok: true, message: "Deleted." };
}
