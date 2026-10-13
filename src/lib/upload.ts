"use client";

import { prepareUpload } from "@/features/uploads/actions";
import { createAnonBrowserClient } from "@/lib/supabase/browser";
import { uploadTarget, type UploadKind } from "@/lib/upload-rules";

/**
 * Uploads a file to Storage (`{bucket}/{user_id}/{uuid}.{ext}`, ARCHITEKTURA
 * 4.4) and returns its public https URL. The server checks the session and
 * signs a one-file upload URL; the browser sends the file to it without a
 * session (the session cookies are httpOnly).
 */
export async function uploadFile(file: File, kind: UploadKind): Promise<string> {
  const target = uploadTarget(kind, file.type, file.size);
  if (!target.ok) throw new Error(target.error);
  const signed = await prepareUpload({ kind, type: file.type, size: file.size });
  if (!signed.ok) throw new Error(signed.error);
  const { error } = await createAnonBrowserClient()
    .storage.from(signed.bucket)
    .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type });
  if (error) throw new Error("Upload failed. Do you have permission to add content?");
  return signed.publicUrl;
}

export const uploadImage = (file: File) => uploadFile(file, "image");
