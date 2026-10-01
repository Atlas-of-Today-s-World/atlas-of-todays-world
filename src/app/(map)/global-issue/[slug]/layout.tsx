import type { ReactNode } from "react";
import { redirectOrNotFound } from "@/features/redirects/queries";
import { getAtlas } from "@/features/geography/queries";

/**
 * Neznámá adresa → přesměrování (správa v administraci), jinak skutečná 404,
 * obojí ještě před streamováním. Stránka má
 * loading.tsx, takže notFound() až v ní by odešel se stavem 200.
 */
export default async function IssueLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!(await getAtlas()).issueBySlug.has(slug)) return redirectOrNotFound(`/global-issue/${slug}`);
  return children;
}
