import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EncyclopediaArticle } from "@/features/entries/components/EncyclopediaArticle";
import { NewsArticle } from "@/features/entries/components/NewsArticle";
import { getPreview } from "@/features/entries/queries";
import { getAtlas } from "@/features/geography/queries";
import { format, getMessages } from "@/features/i18n/messages";
import { localeFrom } from "@/features/i18n/request";
import { DATE_INTL } from "@/lib/format";

// Náhled nezveřejněného článku přes sdílený odkaz (G2): vždy čerstvý, nikdy v indexu.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return {
    title: getMessages(await localeFrom(params)).preview.title,
    robots: { index: false, follow: false },
  };
}

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { token } = await params;
  const locale = await localeFrom(params);
  const t = getMessages(locale).preview;
  const [preview, atlas] = await Promise.all([getPreview(token), getAtlas(locale)]);
  if (!preview) notFound();
  const expires = new Intl.DateTimeFormat(DATE_INTL[locale], {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(preview.expiresAt));

  const banner = (
    <p
      role="note"
      className="border-b border-amber-300 bg-amber-50 px-6 py-3 text-[12.5px] text-amber-900 sm:px-10"
    >
      <strong>{t.title}</strong> — {preview.status === "published" ? t.published : t.notPublished}.{" "}
      {format(t.expires, { date: expires })}
    </p>
  );

  return preview.kind === "entry" ? (
    <EncyclopediaArticle item={preview.item} atlas={atlas} banner={banner} />
  ) : (
    <NewsArticle item={preview.item} atlas={atlas} banner={banner} />
  );
}
