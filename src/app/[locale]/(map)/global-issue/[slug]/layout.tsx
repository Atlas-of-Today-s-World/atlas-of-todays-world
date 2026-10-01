import type { ReactNode } from "react";
import { redirectOrNotFound } from "@/features/redirects/queries";
import { getAtlas } from "@/features/geography/queries";
import { localeFrom } from "@/features/i18n/request";

/**
 * Unknown URL → redirect (managed in the admin), otherwise a real 404,
 * both before streaming starts. The page has
 * loading.tsx, so notFound() inside it would be sent with status 200.
 */
export default async function IssueLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { slug } = await params;
  if (!(await getAtlas(await localeFrom(params))).issueBySlug.has(slug))
    return redirectOrNotFound(`/global-issue/${slug}`, await localeFrom(params));
  return children;
}
