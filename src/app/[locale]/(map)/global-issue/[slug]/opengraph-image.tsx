import { getAtlas } from "@/features/geography/queries";
import { getMessages } from "@/features/i18n/messages";
import { localeFrom } from "@/features/i18n/request";
import { OG_SIZE, renderOg } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Global issue — Atlas of Today's World";

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const locale = await localeFrom(params);
  const t = getMessages(locale).og;
  const issue = (await getAtlas(locale)).issueBySlug.get((await params).slug);
  return renderOg({
    kicker: issue?.kind === "region" ? t.region : t.issue,
    title: issue?.name ?? t.site,
    subtitle: issue?.subtitle || issue?.summary,
    accent: issue?.fill,
  });
}
