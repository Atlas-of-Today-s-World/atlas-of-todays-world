import "server-only";
import { unstable_cache } from "next/cache";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { DEFAULT_LOCALE, localePath, type Locale } from "@/features/i18n/config";
import { PUBLIC_REVALIDATE_SECONDS, tags } from "@/lib/cache/tags";
import { safeRedirect } from "@/lib/security/redirect";
import { createPublicClient } from "@/lib/supabase/public";
import { buildRedirectMap, matchRedirect, type RedirectRule } from "./schema";

/**
 * All redirects in one query, cached with the `redirects` tag — so the 404
 * page doesn't hit the DB; adding/deleting in the admin refreshes the cache.
 * DB outage = no redirects (the page simply stays 404).
 */
const getRedirectMap = unstable_cache(
  async (): Promise<Record<string, RedirectRule>> => {
    const { data, error } = await createPublicClient()
      .from("redirects")
      .select("from_path, to_path, permanent")
      .limit(5000);
    if (error) {
      console.error("[redirects]", error.message);
      return {};
    }
    return buildRedirectMap(data);
  },
  ["redirects"],
  { tags: [tags.redirects], revalidate: PUBLIC_REVALIDATE_SECONDS },
);

/**
 * Instead of 404: if there's a redirect for the path, sends there (308/307), otherwise 404.
 * Applies only to non-existent pages — a redirect doesn't override a live URL.
 */
export async function redirectOrNotFound(
  pathname: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<never> {
  const rule = matchRedirect(await getRedirectMap(), pathname);
  if (rule) {
    // The DB already restricts the target to a path on this site; safeRedirect is a second safety net.
    // Target in the same language the visitor came in (/cs/old → /cs/new).
    const target = safeRedirect(
      rule.to.startsWith("/") ? localePath(locale, rule.to) : rule.to,
      "",
    );
    if (target) {
      if (rule.permanent) permanentRedirect(target);
      redirect(target);
    }
  }
  notFound();
}
