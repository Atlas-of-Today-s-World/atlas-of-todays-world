import { getAtlas } from "@/features/geography/queries";
import { getMessages } from "@/features/i18n/messages";
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
  const locale = await localeFrom(params);
  const t = getMessages(locale).og;
  const country = (await getAtlas(locale)).countryBySlug.get((await params).slug);
  return renderOg({
    kicker: country?.region?.name ?? t.country,
    title: country?.name ?? t.site,
    subtitle: country?.profile.summary || country?.nameFormal || undefined,
    accent: country?.region?.fill,
  });
}
