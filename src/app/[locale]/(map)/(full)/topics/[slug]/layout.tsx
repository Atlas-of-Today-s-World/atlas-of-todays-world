import { localeFrom } from "@/features/i18n/request";
import type { ReactNode } from "react";
import { redirectOrNotFound } from "@/features/redirects/queries";
import { getEncyclopediaEntry } from "@/features/entries/queries";

/**
 * Unknown URL → redirect (managed in the admin), otherwise a real 404,
 * both before streaming starts. The page has
 * loading.tsx, so notFound() inside it would be sent with status 200.
 */
export default async function EntryLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { slug } = await params;
  if (!(await getEncyclopediaEntry(slug, await localeFrom(params))))
    return redirectOrNotFound(`/topics/${slug}`, await localeFrom(params));
  return children;
}
