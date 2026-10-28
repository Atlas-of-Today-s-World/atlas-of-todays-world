import { getAtlas } from "@/features/geography/queries";
import { ogImage, quietGlobe, subjectGlobe, worldGlobe } from "@/features/seo/og-image";

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
    accent: region?.fill,
    globe: region ? subjectGlobe(region.center, region.countries, region.fill) : quietGlobe,
  };
});

export const issueOgImage = ogImage<{ slug: string }>(async ({ slug, locale }, { og: t }) => {
  const atlas = await getAtlas(locale);
  const issue = atlas.issueBySlug.get(slug);
  return {
    kicker: issue?.kind === "region" ? t.region : t.issue,
    title: issue?.name ?? t.site,
    accent: issue?.fill,
    // An issue without member countries (migration, climate…) shows the world around its centre.
    globe: !issue
      ? quietGlobe
      : issue.countries.length
        ? subjectGlobe(issue.center, issue.countries, issue.fill)
        : worldGlobe(atlas, issue.center),
  };
});
