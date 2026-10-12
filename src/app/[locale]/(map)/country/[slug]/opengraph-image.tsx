import { getAtlas } from "@/features/geography/queries";
import { ogImage } from "@/features/seo/og-image";
import { OG_SIZE } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Country profile — Atlas of Today's World";

export default ogImage<{ slug: string }>(async ({ slug, locale }, { og: t }) => {
  const country = (await getAtlas(locale)).countryBySlug.get(slug);
  return {
    kicker: country?.region?.name ?? t.country,
    title: country?.name ?? t.site,
    subtitle: country?.profile.summary || country?.nameFormal || undefined,
    accent: country?.region?.fill,
  };
});
