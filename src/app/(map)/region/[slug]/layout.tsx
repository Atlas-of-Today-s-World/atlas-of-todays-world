import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getAtlas } from "@/features/geography/queries";

/**
 * Neznámá adresa → skutečná 404 ještě před streamováním. Stránka má
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
  if (!(await getAtlas()).regionBySlug.has(slug)) notFound();
  return children;
}
