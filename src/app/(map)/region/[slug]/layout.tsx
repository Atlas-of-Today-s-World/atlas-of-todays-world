import type { ReactNode } from "react";
import { redirectOrNotFound } from "@/features/redirects/queries";
import { getAtlas } from "@/features/geography/queries";

/**
 * Neznámá adresa → přesměrování (správa v administraci), jinak skutečná 404,
 * obojí ještě před streamováním. Stránka má
 * loading.tsx, takže notFound() až v ní by odešel se stavem 200.
 */
export default async function RegionLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!(await getAtlas()).regionBySlug.has(slug)) return redirectOrNotFound(`/region/${slug}`);
  return children;
}
