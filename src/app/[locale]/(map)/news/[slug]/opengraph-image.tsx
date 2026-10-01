import { getEntry } from "@/features/entries/queries";
import { localeFrom } from "@/features/i18n/request";
import { OG_SIZE, renderOg } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "News — Atlas of Today's World";

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const entry = await getEntry((await params).slug, await localeFrom(params));
  return renderOg({
    kicker: entry?.category ?? "News",
    title: entry?.title ?? "Atlas of Today's World",
    subtitle: entry?.summary,
  });
}
