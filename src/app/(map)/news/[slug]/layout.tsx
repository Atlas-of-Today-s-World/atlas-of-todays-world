import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getEntry } from "@/features/entries/queries";

/**
 * Neznámá adresa → skutečná 404 ještě před streamováním. Stránka má
 * loading.tsx, takže notFound() až v ní by odešel se stavem 200.
 */
export default async function NewsLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!(await getEntry(slug))) notFound();
  return children;
}
