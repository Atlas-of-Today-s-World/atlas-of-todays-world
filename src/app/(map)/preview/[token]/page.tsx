import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EncyclopediaArticle } from "@/features/entries/components/EncyclopediaArticle";
import { NewsArticle } from "@/features/entries/components/NewsArticle";
import { getPreview } from "@/features/entries/queries";
import { getAtlas } from "@/features/geography/queries";

// Náhled nezveřejněného článku přes sdílený odkaz (G2): vždy čerstvý, nikdy v indexu.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Preview",
  robots: { index: false, follow: false },
};

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "UTC",
});

export default async function PreviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [preview, atlas] = await Promise.all([getPreview(token), getAtlas()]);
  if (!preview) notFound();

  const banner = (
    <p
      role="note"
      className="border-b border-amber-300 bg-amber-50 px-6 py-3 text-[12.5px] text-amber-900 sm:px-10"
    >
      <strong>Preview</strong> —{" "}
      {preview.status === "published" ? "published" : "not published yet"}. This link expires on{" "}
      {dateFormat.format(new Date(preview.expiresAt))} UTC.
    </p>
  );

  return preview.kind === "entry" ? (
    <EncyclopediaArticle item={preview.item} atlas={atlas} banner={banner} />
  ) : (
    <NewsArticle item={preview.item} atlas={atlas} banner={banner} />
  );
}
