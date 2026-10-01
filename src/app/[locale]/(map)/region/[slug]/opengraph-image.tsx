import { getAtlas } from "@/features/geography/queries";
import { getMessages } from "@/features/i18n/messages";
import { localeFrom } from "@/features/i18n/request";
import { OG_SIZE, renderOg } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "World region — Atlas of Today's World";

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const locale = await localeFrom(params);
  const t = getMessages(locale).og;
  const region = (await getAtlas(locale)).regionBySlug.get((await params).slug);
  return renderOg({
    kicker: t.region,
    title: region?.name ?? t.site,
    subtitle: region?.summary,
    accent: region?.fill,
  });
}
