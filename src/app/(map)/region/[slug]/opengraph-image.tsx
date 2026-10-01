import { getAtlas } from "@/features/geography/queries";
import { OG_SIZE, renderOg } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "World region — Atlas of Today's World";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const region = (await getAtlas()).regionBySlug.get((await params).slug);
  return renderOg({
    kicker: "World region",
    title: region?.name ?? "Atlas of Today's World",
    subtitle: region?.summary,
    accent: region?.fill,
  });
}
