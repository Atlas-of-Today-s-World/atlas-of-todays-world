import "server-only";
import { updateTag } from "next/cache";
import type { signedIn } from "@/lib/actions";
import { entryChangedTags, tags } from "@/lib/cache/tags";
import { DEFAULT_LOCALE, isLocale, localePath } from "@/features/i18n/config";
import { notifyIndexNow } from "@/lib/seo/indexnow";
import { routes } from "@/config/routes";

/**
 * Cache purge and IndexNow ping after an article changes, shared by the entry
 * actions (`actions.ts`, `parts-actions.ts`, `workflow-actions.ts`). Not a
 * "use server" module: nothing here is callable from the client.
 */

/** After published content changes, revalidate lists, detail and portraits. */
export function refresh(slug?: string | null, region?: string | null, issue?: string | null) {
  for (const tag of entryChangedTags(slug)) updateTag(tag);
  if (region) updateTag(tags.portrait("region", region));
  if (issue) updateTag(tags.portrait("issue", issue));
}

/**
 * After the response, tells IndexNow engines (Bing → ChatGPT search, Seznam…)
 * that the article's page changed, appeared or disappeared (ADR-021).
 */
export function pingSearchEngines(row: { slug: string; kind: string; locale: string }) {
  const locale = isLocale(row.locale) ? row.locale : DEFAULT_LOCALE;
  const path = localePath(locale, routes.article(row.kind, row.slug));
  notifyIndexNow([path]);
}

/**
 * Revalidates an article's cache by its placement (`onlyPublished`: only when
 * it's live). Returns the row it read (null = gone or not visible).
 */
export async function refreshEntry(supabase: Client, id: string, onlyPublished = false) {
  const { data } = await supabase
    .from("entries")
    .select("slug, status, region_slug, special_slug, kind, locale")
    .eq("id", id)
    .maybeSingle();
  if (onlyPublished && data?.status !== "published") return data;
  refresh(data?.slug, data?.region_slug, data?.special_slug);
  if (data) pingSearchEngines(data);
  return data;
}

export type Client = NonNullable<Awaited<ReturnType<typeof signedIn>>>["supabase"];
