import "server-only";
import { unstable_cache } from "next/cache";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { DEFAULT_LOCALE, localePath, type Locale } from "@/features/i18n/config";
import { PUBLIC_REVALIDATE_SECONDS, tags } from "@/lib/cache/tags";
import { safeRedirect } from "@/lib/security/redirect";
import { createPublicClient } from "@/lib/supabase/public";
import { buildRedirectMap, matchRedirect, type RedirectRule } from "./schema";

/**
 * Všechna přesměrování jedním dotazem v cache s tagem `redirects` — stránka
 * 404 se tak na DB neptá; přidání/smazání v administraci cache obnoví.
 * Výpadek DB = žádná přesměrování (stránka prostě zůstane 404).
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
 * Místo 404: je-li pro cestu přesměrování, pošle tam (308/307), jinak 404.
 * Platí jen pro neexistující stránky — živou adresu přesměrování nepřebije.
 */
export async function redirectOrNotFound(
  pathname: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<never> {
  const rule = matchRedirect(await getRedirectMap(), pathname);
  if (rule) {
    // DB už cíl omezuje na cestu na tomto webu; safeRedirect je druhá pojistka.
    // Cíl ve stejném jazyce, v jakém návštěvník přišel (/cs/stará → /cs/nová).
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
