import { getMessages } from "@/features/i18n/messages";
import { localeFrom } from "@/features/i18n/request";
import { OG_SIZE, renderOg } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Atlas Patrons — Atlas of Today's World";

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const t = getMessages(await localeFrom(params));
  return renderOg({
    kicker: t.og.patrons,
    title: `${t.patrons.heroTitle} ${t.patrons.heroTitleAccent}`,
    subtitle: t.patrons.description,
    accent: "#2563eb",
  });
}
