import { localeFrom } from "@/features/i18n/request";
import type { ReactNode } from "react";
import { redirectOrNotFound } from "@/features/redirects/queries";
import { getEncyclopediaEntry } from "@/features/entries/queries";

/**
 * Neznámá adresa → přesměrování (správa v administraci), jinak skutečná 404,
 * obojí ještě před streamováním. Stránka má
 * loading.tsx, takže notFound() až v ní by odešel se stavem 200.
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
    return redirectOrNotFound(`/entry/${slug}`, await localeFrom(params));
  return children;
}
