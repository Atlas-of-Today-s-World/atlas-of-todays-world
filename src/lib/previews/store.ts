import "server-only";
import type { createServerClient } from "@/lib/supabase/server";
import { findPreviewImages } from "./preview-image";

type Client = Awaited<ReturnType<typeof createServerClient>>;

/** Whose resources: a topic's, or a region's / global issue's portrait. */
export type ResourceOwner =
  { column: "entry_id"; value: string } | { column: "region_slug" | "special_slug"; value: string };

/**
 * After an editor saved resources: links still without an image get the
 * preview their page declares (lib/previews/preview-image.ts), written onto
 * the saved rows with the editor's own session, so RLS decides as for the
 * save. Runs only after the save succeeded — someone who may not edit never
 * makes the server fetch anything — and never fails it: whatever isn't found
 * within the budget simply stays without an image (at most 8 links per save).
 *
 * Returns { link → image } of what was stored, for the editor to show.
 */
export async function storePreviewImages(
  supabase: Client,
  owner: ResourceOwner,
  links: readonly { url: string; image_url?: string | null }[],
): Promise<Record<string, string>> {
  const found = await findPreviewImages(links.filter((link) => !link.image_url).map((l) => l.url));
  const stored = await Promise.all(
    [...found].map(async ([url, image]) => {
      const { data } = await supabase
        .from("resources")
        .update({ image_url: image })
        .eq(owner.column, owner.value)
        .eq("url", url)
        // Never over an image an editor set in the meantime.
        .is("image_url", null)
        .select("id");
      // Only what was really written (an error or RLS leaves no rows).
      return data?.length ? ([url, image] as const) : null;
    }),
  );
  return Object.fromEntries(stored.filter((pair) => pair !== null));
}

/** " Preview images added to 3 links." after a save message, or nothing. */
export function previewNote(previews: Record<string, string>): string {
  const added = Object.keys(previews).length;
  return added ? ` Preview images added to ${added} ${added === 1 ? "link" : "links"}.` : "";
}
