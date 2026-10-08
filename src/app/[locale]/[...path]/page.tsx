import type { Metadata } from "next";
import { getMessages } from "@/features/i18n/messages";
import { localeFrom } from "@/features/i18n/request";
import { redirectOrNotFound } from "@/features/redirects/queries";

/**
 * URLs that don't exist on the site (old URLs, renamed pages): redirects per
 * the `redirects` table, otherwise renders the regular 404 page.
 *
 * Specific routes always take precedence; only what would be a 404 lands here.
 * Rendered on demand (not ISR) so that every random URL from robots isn't
 * cached; redirects are read from `unstable_cache`, not from the DB.
 */
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ locale: string; path: string[] }> };

/** The 404 page's title (a redirect never shows it); not-found.tsx can't set one. */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  return { title: getMessages(await localeFrom(params)).errors.pageNotFoundTitle };
}

export default async function UnknownPath({ params }: Params) {
  const { path } = await params;
  return redirectOrNotFound(`/${path.join("/")}`, await localeFrom(params));
}
