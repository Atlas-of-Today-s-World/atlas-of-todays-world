import { getEntry } from "@/features/entries/queries";
import { ogImage } from "@/features/seo/og-image";
import { categoryLabel } from "@/lib/content-types";
import { OG_SIZE } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "News — Atlas of Today's World";

export default ogImage<{ slug: string }>(async ({ slug, locale }, messages) => {
  const entry = await getEntry(slug, locale);
  return {
    kicker: entry ? categoryLabel(entry.category, messages) : messages.og.news,
    title: entry?.title ?? messages.og.site,
    subtitle: entry?.summary,
  };
});
