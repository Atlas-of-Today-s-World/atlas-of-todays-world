import { localeFrom } from "@/features/i18n/request";
import type { ReactNode } from "react";
import { redirectOrNotFound } from "@/features/redirects/queries";
import { getEntry } from "@/features/entries/queries";
import { routes } from "@/config/routes";

/**
 * Unknown URL → redirect (managed in the admin), otherwise a real 404,
 * both before streaming starts. The page has
 * loading.tsx, so notFound() inside it would be sent with status 200.
 */
export default async function NewsLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { slug } = await params;
  if (!(await getEntry(slug, await localeFrom(params))))
    return redirectOrNotFound(routes.news(slug), await localeFrom(params));
  return children;
}
