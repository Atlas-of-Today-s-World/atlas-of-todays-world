import "server-only";
import { unstable_cache } from "next/cache";
import { PUBLIC_REVALIDATE_SECONDS, tags } from "@/lib/cache/tags";
import type { RegionDossier } from "@/lib/content-types";
import { createPublicClient } from "@/lib/supabase/public";

type Kind = "region" | "issue";

/**
 * Editorial content of a region or global issue portrait — in a single call to the
 * DB function `portrait()` (ARCHITEKTURA 4.2). Empty sections render the portrait greyed out.
 */
export function getPortrait(kind: Kind, slug: string): Promise<RegionDossier> {
  return unstable_cache(
    async (): Promise<RegionDossier> => {
      const { data, error } = await createPublicClient().rpc("portrait", {
        p_kind: kind,
        p_slug: slug,
      });
      if (error) throw new Error(`[portrait] ${error.message}`);
      if (!data) return {};
      // The JSON shape is defined by the DB function portrait(); null from the DB → undefined for components.
      const dossier = data as unknown as Omit<
        RegionDossier,
        "timelineTitle" | "timelineSubtitle"
      > & {
        timelineTitle: string | null;
        timelineSubtitle: string | null;
      };
      return {
        ...dossier,
        timelineTitle: dossier.timelineTitle ?? undefined,
        timelineSubtitle: dossier.timelineSubtitle ?? undefined,
        // A card without a citation isn't published (P1); the DB enforces it, this is a safety net.
        metrics: (dossier.metrics ?? []).filter((metric) => metric.source?.trim()),
      };
    },
    ["portrait", kind, slug],
    { tags: [tags.portrait(kind, slug)], revalidate: PUBLIC_REVALIDATE_SECONDS },
  )();
}
