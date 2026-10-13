/**
 * What may be uploaded to Storage: bucket, allowed types (MIME → extension),
 * size cap and message. The DB bucket also enforces type and size — this is
 * only so the error shows up immediately and in plain language. Shared by the
 * upload form (browser) and the action that signs the upload (server); no Zod.
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

/** The kinds for validating input (`satisfies`: none that KINDS doesn't define). */
export const UPLOAD_KINDS = ["image", "audio"] as const satisfies readonly UploadKind[];

export const ACCEPT_IMAGES = Object.keys(KINDS.image.types).join(",");
export const ACCEPT_AUDIO = Object.keys(KINDS.audio.types).join(",");

/** The bucket and file extension for a file, or the reason it can't be uploaded. */
export function uploadTarget(
  kind: UploadKind,
  type: string,
  size: number,
): { ok: true; bucket: string; ext: string } | { ok: false; error: string } {
  const rules = KINDS[kind];
  const ext = Object.hasOwn(rules.types, type) ? rules.types[type] : undefined;
  if (!ext) return { ok: false, error: rules.typeError };
  if (size > rules.maxBytes) return { ok: false, error: rules.sizeError };
  return { ok: true, bucket: rules.bucket, ext };
}
