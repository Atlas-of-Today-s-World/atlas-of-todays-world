import { getAtlas } from "@/features/geography/queries";
import { OG_SIZE, renderOg } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Country profile — Atlas of Today's World";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const country = (await getAtlas()).countryBySlug.get((await params).slug);
  return renderOg({
    kicker: country?.region?.name ?? "Country profile",
    title: country?.name ?? "Atlas of Today's World",
    subtitle: country?.profile.summary || country?.nameFormal || undefined,
    accent: country?.region?.fill,
  });
}
