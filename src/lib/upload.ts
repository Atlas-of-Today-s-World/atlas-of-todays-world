"use client";

import { createBrowserClient } from "@/lib/supabase/browser";

const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
export const ACCEPT_IMAGES = Object.keys(TYPES).join(",");

/**
 * Nahraje obrázek do Storage (`entry-images/{user_id}/{uuid}.{ext}`,
 * ARCHITEKTURA 4.4) a vrátí jeho veřejnou https adresu. Typ a velikost hlídá
 * i bucket; SVG schválně ne (může nést skript).
 */
export async function uploadImage(file: File): Promise<string> {
  const ext = TYPES[file.type];
  if (!ext) throw new Error("Povolené jsou JPEG, PNG, WebP a AVIF.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Obrázek může mít nejvýš 3 MB.");
  const supabase = createBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Přihlaste se prosím znovu.");
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("entry-images")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error("Nahrání se nepovedlo. Máte právo přidávat obsah?");
  return supabase.storage.from("entry-images").getPublicUrl(path).data.publicUrl;
}
