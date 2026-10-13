"use server";

import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { signedIn } from "@/lib/actions";
import { UPLOAD_KINDS, uploadTarget } from "@/lib/upload-rules";

const UploadRequest = z.object({
  kind: z.enum(UPLOAD_KINDS),
  type: z.string().max(100),
  size: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
});

export type PreparedUpload =
  | {
      ok: true;
      bucket: string;
      path: string;
      /** Signed upload token: lets the browser write this one new object, nothing else. */
      token: string;
      publicUrl: string;
    }
  | { ok: false; error: string };

const FAILED = "Upload failed. Do you have permission to add content?";

/**
 * Step 1 of an upload (ARCHITEKTURA 4.4): checks the file's kind, type and
 * size, then signs an upload URL for `{bucket}/{user_id}/{uuid}.{ext}` under the
 * caller's session. Storage tests the INSERT policy (section news "c", own
 * folder) when signing, and the bucket still enforces type and size on the
 * upload itself. The browser never gets the session — only this one-object
 * token, which can't overwrite (no upsert) or read anything.
 */
export async function prepareUpload(input: unknown): Promise<PreparedUpload> {
  const parsed = UploadRequest.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid file." };
  const { kind, type, size } = parsed.data;
  const target = uploadTarget(kind, type, size);
  if (!target.ok) return target;

  const session = await signedIn();
  if (!session) return { ok: false, error: "Please sign in again." };

  const path = `${session.user.id}/${randomUUID()}.${target.ext}`;
  const bucket = session.supabase.storage.from(target.bucket);
  const { data, error } = await bucket.createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: FAILED };
  return {
    ok: true,
    bucket: target.bucket,
    path: data.path,
    token: data.token,
    publicUrl: bucket.getPublicUrl(data.path).data.publicUrl,
  };
}
