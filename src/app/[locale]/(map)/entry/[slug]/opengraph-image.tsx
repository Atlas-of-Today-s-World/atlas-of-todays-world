import { getEncyclopediaEntry } from "@/features/entries/queries";
import { getMessages } from "@/features/i18n/messages";
import { localeFrom } from "@/features/i18n/request";
import { OG_SIZE, renderOg } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Encyclopedic entry — Atlas of Today's World";

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const locale = await localeFrom(params);
  const messages = getMessages(locale);
  const entry = await getEncyclopediaEntry((await params).slug, locale);
  return renderOg({
    kicker: entry ? messages.categories[entry.category] : messages.og.entry,
    title: entry?.title ?? messages.og.site,
    subtitle: entry?.summary,
  });
}
