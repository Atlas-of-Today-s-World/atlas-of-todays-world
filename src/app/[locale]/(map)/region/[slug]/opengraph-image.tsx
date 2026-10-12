import { getAtlas } from "@/features/geography/queries";
import { ogImage } from "@/features/seo/og-image";
import { OG_SIZE } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "World region — Atlas of Today's World";

export default ogImage<{ slug: string }>(async ({ slug, locale }, { og: t }) => {
  const region = (await getAtlas(locale)).regionBySlug.get(slug);
  return {
    kicker: t.region,
    title: region?.name ?? t.site,
    subtitle: region?.summary,
    accent: region?.fill,
  };
});
