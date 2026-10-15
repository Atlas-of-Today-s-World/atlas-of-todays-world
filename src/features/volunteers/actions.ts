"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { affected, formAction, idAction, invalidCodes } from "@/lib/actions";
import type { ActionState } from "@/lib/action-state";
import { adminRoutes } from "@/config/routes";
import { serverEnv } from "@/lib/env.server";
import { allowRequest } from "@/lib/security/rate-limit";
import { passesCaptcha } from "@/lib/security/turnstile";
import { createServiceClient } from "@/lib/supabase/service";
import { APPLICATION_STATUSES, ApplicationInput, SettingsInput } from "./schema";

const ADMIN_PAGE = adminRoutes.volunteers;

/**
 * A visitor applies to edit content as a volunteer (/membership). Results are
 * codes (messages: patrons.volunteer.messages). Honeypot `website`, a shared
 * per-IP rate limit, Turnstile after validation (only with both keys set), then
 * the DB function (which also caps applications per hour). The e-mail to the address set in the admin is sent later (not yet).
 */
export async function applyAsVolunteer(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (String(formData.get("website") ?? "").trim()) return { ok: true, message: "thanks" };
  const request = await headers();
  if (!(await allowRequest("volunteer", request, { limit: 3, windowSeconds: 3600 }))) {
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
  if (!(await passesCaptcha(formData, request))) return { ok: false, error: "captcha" };
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
export const saveVolunteerSettings = formAction(SettingsInput, async ({ data, supabase }) => {
  const denied = affected(
    await supabase
      .from("volunteer_settings")
      .update({ notify_email: data.notify_email || null })
      .eq("id", 1)
      .select("id"),
    "You can't change where applications go.",
  );
  if (denied) return denied;
  revalidatePath(ADMIN_PAGE);
  return { ok: true, message: "Saved." };
});

const Status = z.enum(APPLICATION_STATUSES);

export const setApplicationStatus = idAction(
  async ({ id, supabase }, status: string) => {
    const parsed = Status.safeParse(status);
    if (!parsed.success) return { ok: false, error: "Invalid application." };
    const denied = affected(
      await supabase
        .from("volunteer_applications")
        .update({ status: parsed.data })
        .eq("id", id)
        .select("id"),
      "You can't change applications.",
    );
    if (denied) return denied;
    revalidatePath(ADMIN_PAGE);
    return { ok: true, message: "Updated." };
  },
  { invalid: "Invalid application." },
);

export const deleteApplication = idAction(
  async ({ id, supabase }) => {
    const denied = affected(
      await supabase.from("volunteer_applications").delete().eq("id", id).select("id"),
      "You can't delete applications.",
    );
    if (denied) return denied;
    revalidatePath(ADMIN_PAGE);
    return { ok: true, message: "Deleted." };
  },
  { invalid: "Invalid application." },
);
