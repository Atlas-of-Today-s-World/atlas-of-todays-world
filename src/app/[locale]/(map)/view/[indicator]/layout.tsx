import type { ReactNode } from "react";
import { redirectOrNotFound } from "@/features/redirects/queries";
import { getAtlas } from "@/features/geography/queries";
import { localeFrom } from "@/features/i18n/request";

/**
 * Unknown URL → redirect (managed in the admin), otherwise a real 404,
 * both before streaming starts. The page has
 * loading.tsx, so notFound() inside it would be sent with status 200.
 */
export default async function ViewLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string; indicator: string }>;
}) {
  const { indicator } = await params;
  if (!(await getAtlas(await localeFrom(params))).indicatorById.has(indicator))
    return redirectOrNotFound(`/view/${indicator}`, await localeFrom(params));
  return children;
}
