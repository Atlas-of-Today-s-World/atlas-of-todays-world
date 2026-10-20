import "server-only";
import { unstable_cache } from "next/cache";
import { PUBLIC_REVALIDATE_SECONDS, tags } from "@/lib/cache/tags";
import { must } from "@/lib/db/result";
import { createPublicClient } from "@/lib/supabase/public";
import { uuid } from "@/lib/validation/common";

export interface VisualHtml {
  title: string;
  html: string;
}

/**
 * One visual's custom code for /api/visual-html (ADR-032), read as the public
 * reads it (RLS: a region's or global issue's always, a topic's only once it
 * is published) and cached under the visual's own tag, which a save or a
 * removal updates. Not a uuid, not custom code or not public → null.
 */
export async function getVisualHtml(id: string): Promise<VisualHtml | null> {
  if (!uuid.safeParse(id).success) return null;
  return unstable_cache(
    async (): Promise<VisualHtml | null> => {
      const row = must(
        await createPublicClient()
          .from("visuals")
          .select("title, kind, html")
          .eq("id", id)
          .maybeSingle(),
        "visual html",
      );
      return row?.kind === "html" && row.html ? { title: row.title, html: row.html } : null;
    },
    ["visual-html", id],
    { tags: [tags.visualHtml(id)], revalidate: PUBLIC_REVALIDATE_SECONDS },
  )();
}
