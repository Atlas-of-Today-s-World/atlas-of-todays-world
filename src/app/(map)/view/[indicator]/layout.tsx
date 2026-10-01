import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getAtlas } from "@/features/geography/queries";

/**
 * Neznámá adresa → skutečná 404 ještě před streamováním. Stránka má
 * loading.tsx, takže notFound() až v ní by odešel se stavem 200.
 */
export default async function ViewLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ indicator: string }>;
}) {
  const { indicator } = await params;
  if (!(await getAtlas()).indicatorById.has(indicator)) notFound();
  return children;
}
