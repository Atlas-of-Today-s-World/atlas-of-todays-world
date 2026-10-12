import { getAtlas } from "@/features/geography/queries";
import { ogImage } from "@/features/seo/og-image";
import { OG_SIZE } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Global issue — Atlas of Today's World";

export default ogImage<{ slug: string }>(async ({ slug, locale }, { og: t }) => {
  const issue = (await getAtlas(locale)).issueBySlug.get(slug);
  return {
    kicker: issue?.kind === "region" ? t.region : t.issue,
    title: issue?.name ?? t.site,
    subtitle: issue?.subtitle || issue?.summary,
    accent: issue?.fill,
  };
});
