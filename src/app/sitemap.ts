import type { MetadataRoute } from "next";
import { getEncyclopediaEntries, getEntries } from "@/features/entries/queries";
import { getAtlas } from "@/features/geography/queries";
import { LEGAL_NAV } from "@/config/navigation";
import { LOCALES, localePath, type Locale } from "@/features/i18n/config";
import { MEMBERSHIP_PATH } from "@/features/membership/config";
import { SITE_URL } from "@/lib/site";

/**
 * Complete sitemap from the database – every region, country, global issue, data
 * layer, news item and entry has a URL. Redirected URLs (/support) don't belong here.
 * `changeFrequency` tells robots how often to come back.
 */
const languagesOf = (path: string, locales: readonly Locale[]) => ({
  languages: Object.fromEntries(
    locales.map((locale) => [locale, `${SITE_URL}${localePath(locale, path)}`]),
  ),
});

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const [atlas, entries, encyclopedia] = await Promise.all([
    getAtlas(),
    getEntries(),
    getEncyclopediaEntries(),
  ]);
  const page = (
    path: string,
    changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>,
    priority: number,
    extra: Partial<MetadataRoute.Sitemap[number]> = {},
  ) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
    // Language versions of the same page (hreflang in the sitemap, G5).
    alternates: {
      languages: Object.fromEntries(
        LOCALES.map((locale) => [locale, `${SITE_URL}${localePath(locale, path || "/")}`]),
      ),
    },
    ...extra,
  });

  return [
    page("", "daily", 1),
    page("/news", "weekly", 0.7),
    page("/about", "yearly", 0.4),
    page(MEMBERSHIP_PATH, "monthly", 0.5),
    ...LEGAL_NAV.map((item) => page(item.href, "yearly", 0.2)),
    ...atlas.regions.map((region) =>
      page(`/region/${region.slug}`, "weekly", 0.9, {
        images: region.hero ? [region.hero] : undefined,
      }),
    ),
    ...atlas.issues.map((issue) => page(`/global-issue/${issue.slug}`, "weekly", 0.8)),
    ...atlas.countries.map((country) => page(`/country/${country.slug}`, "monthly", 0.8)),
    ...atlas.indicators.map((indicator) => page(`/view/${indicator.id}`, "yearly", 0.7)),
    // News and entries: hreflang only for languages with a published version (G5.3).
    ...entries.map((item) =>
      page(`/news/${item.slug}`, "monthly", 0.9, {
        alternates: languagesOf(`/news/${item.slug}`, item.languages),
        lastModified: new Date(item.updated ?? item.published ?? now),
        images: item.hero ? [item.hero] : undefined,
      }),
    ),
    ...encyclopedia.map((item) =>
      page(`/entry/${item.slug}`, "monthly", 1, {
        alternates: languagesOf(`/entry/${item.slug}`, item.languages),
        lastModified: new Date(item.updated ?? item.published ?? now),
        images: item.hero ? [item.hero] : undefined,
      }),
    ),
  ];
}
