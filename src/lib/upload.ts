"use client";

import { createBrowserClient } from "@/lib/supabase/browser";

/**
 * Co se smí nahrát do Storage: bucket, povolené typy (MIME → přípona),
 * strop velikosti a hláška. Typ a velikost hlídá i bucket v DB — tady jde
 * jen o to, aby chyba přišla hned a česky.
 */
const KINDS = {
  // SVG schválně ne (může nést skript).
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
  // Zvuková verze hesla (P9): pět běžných formátů, jak je posílají různé systémy.
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
 * Nahraje soubor do Storage (`{bucket}/{user_id}/{uuid}.{ext}`, ARCHITEKTURA
 * 4.4) a vrátí jeho veřejnou https adresu.
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
