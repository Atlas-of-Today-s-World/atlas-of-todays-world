import { getAtlas } from "@/features/geography/queries";
import { ogImage } from "@/features/seo/og-image";

/**
 * Share picture of a country, for both of its views (the panel preview and
 * `/country/<slug>/full-page`) — each route's opengraph-image re-exports it
 * and declares size / contentType / alt itself, where Next reads them.
 */
export const countryOgImage = ogImage<{ slug: string }>(async ({ slug, locale }, { og: t }) => {
  const country = (await getAtlas(locale)).countryBySlug.get(slug);
  return {
    kicker: country?.region?.name ?? t.country,
    title: country?.name ?? t.site,
    subtitle: country?.profile.summary || country?.nameFormal || undefined,
    accent: country?.region?.fill,
  };
});
