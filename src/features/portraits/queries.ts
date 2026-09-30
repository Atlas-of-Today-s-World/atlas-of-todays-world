import "server-only";
import { unstable_cache } from "next/cache";
import { PUBLIC_REVALIDATE_SECONDS, tags } from "@/lib/cache/tags";
import type { RegionDossier } from "@/lib/content-types";
import { createPublicClient } from "@/lib/supabase/public";

type Kind = "region" | "issue";

/**
 * Redakční obsah portrétu regionu nebo global issue — jedním voláním DB funkce
 * `portrait()` (ARCHITEKTURA 4.2). Prázdné sekce kreslí portrét šedivě.
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
      // Tvar JSON drží DB funkce portrait(); null z DB → undefined pro komponenty.
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
        // Bez citace se karta nepublikuje (P1); DB to vynucuje, tady pojistka.
        metrics: (dossier.metrics ?? []).filter((metric) => metric.source?.trim()),
      };
    },
    ["portrait", kind, slug],
    { tags: [tags.portrait(kind, slug)], revalidate: PUBLIC_REVALIDATE_SECONDS },
  )();
}
