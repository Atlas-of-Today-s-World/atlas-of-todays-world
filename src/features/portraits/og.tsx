import { getAtlas } from "@/features/geography/queries";
import { ogImage } from "@/features/seo/og-image";

/**
 * Share images of a region and a global issue — one generator each, used by
 * both views (the rail preview and the `…/full-page` article). The full page
 * is the canonical one, so it must carry the same picture: without its own
 * opengraph-image file it would fall back to the site's default.
 */
export const regionOgImage = ogImage<{ slug: string }>(async ({ slug, locale }, { og: t }) => {
  const region = (await getAtlas(locale)).regionBySlug.get(slug);
  return {
    kicker: t.region,
    title: region?.name ?? t.site,
    subtitle: region?.summary,
    accent: region?.fill,
  };
});

export const issueOgImage = ogImage<{ slug: string }>(async ({ slug, locale }, { og: t }) => {
  const issue = (await getAtlas(locale)).issueBySlug.get(slug);
  return {
    kicker: issue?.kind === "region" ? t.region : t.issue,
    title: issue?.name ?? t.site,
    subtitle: issue?.subtitle || issue?.summary,
    accent: issue?.fill,
  };
});
