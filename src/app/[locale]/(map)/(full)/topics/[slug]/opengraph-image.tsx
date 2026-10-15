import { getEncyclopediaEntry } from "@/features/entries/topic-queries";
import { ogImage } from "@/features/seo/og-image";
import { categoryLabel } from "@/lib/content-types";
import { OG_SIZE } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Encyclopedic entry — Atlas of Today's World";

export default ogImage<{ slug: string }>(async ({ slug, locale }, messages) => {
  const entry = await getEncyclopediaEntry(slug, locale);
  return {
    kicker: entry ? categoryLabel(entry.category, messages) : messages.og.entry,
    title: entry?.title ?? messages.og.site,
    subtitle: entry?.summary,
  };
});
