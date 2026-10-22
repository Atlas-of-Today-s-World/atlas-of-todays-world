"use server";

import "server-only";
import { randomUUID } from "node:crypto";
import { revalidatePath, updateTag } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { affected, failed, formAction, idAction, invalidCodes } from "@/lib/actions";
import type { ActionState } from "@/lib/action-state";
import { adminRoutes } from "@/config/routes";
import { tags } from "@/lib/cache/tags";
import { serverEnv } from "@/lib/env.server";
import { allowRequest } from "@/lib/security/rate-limit";
import { passesCaptcha } from "@/lib/security/turnstile";
import { createServiceClient } from "@/lib/supabase/service";
import { CV_BUCKET, CV_MAX_BYTES, CV_TYPES, cleanFileName, cvExtension } from "./cv";
import { APPLICATION_STATUSES, ApplicationInput, PositionInput } from "./schema";

const POSITIONS_PAGE = adminRoutes.careers.list;
const APPLICATIONS_PAGE = adminRoutes.careerApplications;

/** The magic bytes `cvExtension` looks at. */
const HEAD_BYTES = 8;

/**
 * A visitor applies for an open position (/careers/<slug>). Results are codes
 * (messages: careersPage.form.messages). Honeypot `website`, a shared per-IP
 * rate limit, the fields, the CV (an accepted format recognised by its first
 * bytes, at most 4 MB), Turnstile (only with both keys set); then the CV goes
 * to the private bucket under a random name and the DB function records the
 * application (it refuses a position that isn't open and caps applications
 * per hour). A refused application takes its CV with it.
 */
export async function applyForPosition(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (String(formData.get("website") ?? "").trim()) return { ok: true, message: "thanks" };
  const request = await headers();
  if (!(await allowRequest("career", request, { limit: 5, windowSeconds: 3600 }))) {
    return { ok: false, error: "rateLimited" };
  }
  const parsed = ApplicationInput.safeParse({
    position_id: formData.get("position_id") ?? "",
    name: formData.get("name") ?? "",
    email: formData.get("email") ?? "",
    message: formData.get("message") ?? "",
    consent: formData.get("consent"),
  });
  if (!parsed.success) return invalidCodes(parsed.error);

  const cv = formData.get("cv");
  if (!(cv instanceof File) || cv.size === 0) return cvError("cv");
  if (cv.size > CV_MAX_BYTES) return cvError("cvTooLarge");
  const bytes = new Uint8Array(await cv.arrayBuffer());
  const ext = cvExtension(cv.name, bytes.subarray(0, HEAD_BYTES));
  if (!ext) return cvError("cvType");

  if (!(await passesCaptcha(formData, request))) return { ok: false, error: "captcha" };
  // Only the server may write (after the checks above); neither the bucket nor the RPC is public.
  if (!serverEnv.SUPABASE_SERVICE_ROLE_KEY) return { ok: false, error: "failed" };
  const service = createServiceClient();
  const path = `${randomUUID()}.${ext}`;
  const upload = await service.storage
    .from(CV_BUCKET)
    .upload(path, bytes, { contentType: CV_TYPES[ext], upsert: false });
  if (upload.error) {
    console.error("[careers] CV upload", upload.error.message);
    return { ok: false, error: "failed" };
  }
  const { error } = await service.rpc("submit_job_application", {
    p_position_id: parsed.data.position_id,
    p_name: parsed.data.name,
    p_email: parsed.data.email,
    p_message: parsed.data.message,
    p_cv_path: path,
    p_cv_name: cleanFileName(cv.name, ext),
    p_cv_size: cv.size,
  });
  if (error) {
    await service.storage.from(CV_BUCKET).remove([path]);
    if (/rate_limited/.test(error.message)) return { ok: false, error: "rateLimited" };
    if (/position_closed/.test(error.message)) return { ok: false, error: "closed" };
    console.error("[careers] application", error.message);
    return { ok: false, error: "failed" };
  }
  return { ok: true, message: "thanks" };
}

const cvError = (code: string): ActionState => ({
  ok: false,
  error: code,
  fieldErrors: { cv: [code] },
});

function positionsChanged() {
  updateTag(tags.careers);
  revalidatePath(POSITIONS_PAGE);
}

/** Adds a position (then opens its page) or saves an existing one. RLS: `site` or `users`. */
export const savePosition = formAction(PositionInput, async ({ data, supabase }) => {
  const { id, ...fields } = data;
  if (!id) {
    const { data: row, error } = await supabase
      .from("job_positions")
      .insert(fields)
      .select("id")
      .single();
    if (error) return slugTaken(error) ?? failed(error);
    positionsChanged();
    redirect(adminRoutes.careers(row.id, { saved: "1" }));
  }
  const result = await supabase.from("job_positions").update(fields).eq("id", id).select("id");
  if (result.error) {
    const taken = slugTaken(result.error);
    if (taken) return taken;
  }
  const denied = affected(result, "You can't edit this position (no permission).");
  if (denied) return denied;
  positionsChanged();
  return {
    ok: true,
    message: fields.status === "open" ? "Saved. The careers page shows the change." : "Saved.",
  };
});

/** A second position with the same address: the error belongs under the field. */
function slugTaken(error: { code?: string }): ActionState | null {
  if (error.code !== "23505") return null;
  return {
    ok: false,
    error: "Please check the highlighted fields.",
    fieldErrors: { slug: ["Another position already has this address."] },
  };
}

/** Deletes a position; its applications stay (with the position's title). */
export const deletePosition = idAction(
  async ({ id, supabase }) => {
    const denied = affected(
      await supabase.from("job_positions").delete().eq("id", id).select("id"),
      "You can't delete positions.",
    );
    if (denied) return denied;
    positionsChanged();
    return { ok: true, message: "Deleted." };
  },
  { invalid: "Invalid position." },
);

const Status = z.enum(APPLICATION_STATUSES);

export const setApplicationStatus = idAction(
  async ({ id, supabase }, status: string) => {
    const parsed = Status.safeParse(status);
    if (!parsed.success) return { ok: false, error: "Invalid application." };
    const denied = affected(
      await supabase
        .from("job_applications")
        .update({ status: parsed.data })
        .eq("id", id)
        .select("id"),
      "You can't change applications.",
    );
    if (denied) return denied;
    revalidatePath(APPLICATIONS_PAGE);
    return { ok: true, message: "Updated." };
  },
  { invalid: "Invalid application." },
);

/** Deletes an application and its CV (storage policy: `users` "d", like the row). */
export const deleteApplication = idAction(
  async ({ id, supabase }) => {
    const result = await supabase.from("job_applications").delete().eq("id", id).select("cv_path");
    const denied = affected(result, "You can't delete applications.");
    if (denied) return denied;
    const paths = (result.data ?? []).map((row) => row.cv_path);
    const removed = await supabase.storage.from(CV_BUCKET).remove(paths);
    if (removed.error) console.error("[careers] CV removal", removed.error.message);
    revalidatePath(APPLICATIONS_PAGE);
    revalidatePath(POSITIONS_PAGE);
    return { ok: true, message: "Deleted." };
  },
  { invalid: "Invalid application." },
);
