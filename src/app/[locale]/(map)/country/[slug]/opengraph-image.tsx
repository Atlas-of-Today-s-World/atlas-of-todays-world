import { getAtlas } from "@/features/geography/queries";
import { localeFrom } from "@/features/i18n/request";
import { OG_SIZE, renderOg } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Country profile — Atlas of Today's World";

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const country = (await getAtlas(await localeFrom(params))).countryBySlug.get((await params).slug);
  return renderOg({
    kicker: country?.region?.name ?? "Country profile",
    title: country?.name ?? "Atlas of Today's World",
    subtitle: country?.profile.summary || country?.nameFormal || undefined,
    accent: country?.region?.fill,
  });
}
