import type { ReactNode } from "react";
import { redirectOrNotFound } from "@/features/redirects/queries";
import { getAtlas } from "@/features/geography/queries";
import { localeFrom } from "@/features/i18n/request";

/**
 * Neznámá adresa → přesměrování (správa v administraci), jinak skutečná 404,
 * obojí ještě před streamováním. Stránka má
 * loading.tsx, takže notFound() až v ní by odešel se stavem 200.
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
