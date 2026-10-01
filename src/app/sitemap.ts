import type { MetadataRoute } from "next";
import { getEncyclopediaEntries, getEntries } from "@/features/entries/queries";
import { getAtlas } from "@/features/geography/queries";
import { LEGAL_NAV } from "@/config/navigation";
import { SITE_URL } from "@/lib/site";

/**
 * Kompletní mapa webu z databáze – každý region, země, global issue, datová
 * vrstva, novinka i heslo má URL. Přesměrované adresy (/support) sem nepatří.
 * `changeFrequency` říká robotům, jak často se sem vracet.
 */
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
  ) => ({ url: `${SITE_URL}${path}`, lastModified: now, changeFrequency, priority, ...extra });

  return [
    page("", "daily", 1),
    page("/news", "weekly", 0.7),
    page("/about", "yearly", 0.4),
    page("/patrons", "yearly", 0.4),
    ...LEGAL_NAV.map((item) => page(item.href, "yearly", 0.2)),
    ...atlas.regions.map((region) =>
      page(`/region/${region.slug}`, "weekly", 0.9, {
        images: region.hero ? [region.hero] : undefined,
      }),
    ),
    ...atlas.issues.map((issue) => page(`/global-issue/${issue.slug}`, "weekly", 0.8)),
    ...atlas.countries.map((country) => page(`/country/${country.slug}`, "monthly", 0.8)),
    ...atlas.indicators.map((indicator) => page(`/view/${indicator.id}`, "yearly", 0.7)),
    ...entries.map((item) =>
      page(`/news/${item.slug}`, "monthly", 0.9, {
        lastModified: new Date(item.updated ?? item.published ?? now),
        images: item.hero ? [item.hero] : undefined,
      }),
    ),
    ...encyclopedia.map((item) =>
      page(`/entry/${item.slug}`, "monthly", 1, {
        lastModified: new Date(item.updated ?? item.published ?? now),
        images: item.hero ? [item.hero] : undefined,
      }),
    ),
  ];
}
