import { getAtlas } from "@/features/geography/queries";
import { ogImage, quietGlobe, subjectGlobe } from "@/features/seo/og-image";

/**
 * Share picture of a country, for both of its views (the panel preview and
 * `/country/<slug>/full-page`) — each route's opengraph-image re-exports it
 * and declares size / contentType / alt itself, where Next reads them.
 */
export const countryOgImage = ogImage<{ slug: string }>(async ({ slug, locale }, { og: t }) => {
  const country = (await getAtlas(locale)).countryBySlug.get(slug);
  const region = country?.region;
  if (!country) return { kicker: t.country, title: t.site, globe: quietGlobe };
  const center: [number, number] =
    country.labelLon !== null && country.labelLat !== null
      ? [country.labelLon, country.labelLat]
      : (region?.center ?? quietGlobe.center);
  return {
    kicker: region ? `${t.country} · ${region.name}` : t.country,
    title: country.name,
    accent: region?.fill,
    globe: subjectGlobe(center, [country.iso3], region?.fill ?? "#fff", true),
  };
});
