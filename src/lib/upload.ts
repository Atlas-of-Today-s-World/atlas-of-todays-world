"use client";

import { createBrowserClient } from "@/lib/supabase/browser";

/**
 * What may be uploaded to Storage: bucket, allowed types (MIME → extension),
 * size cap and message. The DB bucket also enforces type and size — this is
 * only so the error shows up immediately and in plain language.
 */
const KINDS = {
  // Deliberately no SVG (it can carry a script).
  image: {
    bucket: "entry-images",
    types: {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/avif": "avif",
    } as Record<string, string>,
    maxBytes: 3 * 1024 * 1024,
    typeError: "Allowed formats: JPEG, PNG, WebP and AVIF.",
    sizeError: "Images can be at most 3 MB.",
  },
  // Audio version of an entry (P9): five common formats, as various systems send them.
  audio: {
    bucket: "entry-audio",
    types: {
      "audio/mpeg": "mp3",
      "audio/mp3": "mp3",
      "audio/mp4": "m4a",
      "audio/x-m4a": "m4a",
      "audio/aac": "aac",
      "audio/ogg": "ogg",
      "audio/opus": "opus",
      "audio/wav": "wav",
      "audio/x-wav": "wav",
      "audio/wave": "wav",
      "audio/flac": "flac",
      "audio/x-flac": "flac",
    } as Record<string, string>,
    maxBytes: 50 * 1024 * 1024,
    typeError: "Allowed formats: MP3, M4A/AAC, Ogg/Opus, WAV and FLAC.",
    sizeError: "Audio can be at most 50 MB — save a long entry as MP3 or M4A.",
  },
} as const;

export type UploadKind = keyof typeof KINDS;

export const ACCEPT_IMAGES = Object.keys(KINDS.image.types).join(",");
export const ACCEPT_AUDIO = Object.keys(KINDS.audio.types).join(",");

/**
 * Uploads a file to Storage (`{bucket}/{user_id}/{uuid}.{ext}`, ARCHITEKTURA
 * 4.4) and returns its public https URL.
 */
export async function uploadFile(file: File, kind: UploadKind): Promise<string> {
  const rules = KINDS[kind];
  const ext = rules.types[file.type];
  if (!ext) throw new Error(rules.typeError);
  if (file.size > rules.maxBytes) throw new Error(rules.sizeError);
  const supabase = createBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Please sign in again.");
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(rules.bucket)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error("Upload failed. Do you have permission to add content?");
  return supabase.storage.from(rules.bucket).getPublicUrl(path).data.publicUrl;
}

export const uploadImage = (file: File) => uploadFile(file, "image");
