import { getEncyclopediaEntry } from "@/features/entries/queries";
import { OG_SIZE, renderOg } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Encyclopedic entry — Atlas of Today's World";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const entry = await getEncyclopediaEntry((await params).slug);
  return renderOg({
    kicker: entry?.category ?? "Encyclopedia",
    title: entry?.title ?? "Atlas of Today's World",
    subtitle: entry?.summary,
  });
}
