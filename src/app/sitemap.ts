import type { MetadataRoute } from "next";
import { REGIONS } from "@/data/regions";
import { indexableCountries } from "@/lib/countries";
import { INDICATORS } from "@/lib/indicators";
import { allEntries } from "@/lib/content";
import { SITE_URL } from "@/lib/site";

/**
 * Kompletní mapa webu – každý region, země, datová vrstva i heslo má URL.
 * `changeFrequency` říká robotům, jak často se sem vracet: datové vrstvy se
 * mění jednou ročně, hesla průběžně.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries = await allEntries();

  return [
    { url: SITE_URL, lastModified: now, changeFrequency: "daily", priority: 1 },
    {
      url: `${SITE_URL}/entries`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/about`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.4,
    },
    {
      url: `${SITE_URL}/support`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.4,
    },
    ...REGIONS.flatMap((region) => [
      {
        url: `${SITE_URL}/region/${region.slug}`,
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.9,
        images: [region.hero],
      },
      {
        url: `${SITE_URL}/region/${region.slug}/full`,
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.8,
        images: [region.hero],
      },
    ]),
    ...indexableCountries().map((country) => ({
      url: `${SITE_URL}/country/${country.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...INDICATORS.map((indicator) => ({
      url: `${SITE_URL}/view/${indicator.id}`,
      lastModified: now,
      changeFrequency: "yearly" as const,
      priority: 0.7,
    })),
    ...entries.map((entry) => ({
      url: `${SITE_URL}/entry/${entry.slug}`,
      lastModified: entry.updated ? new Date(entry.updated) : now,
      changeFrequency: "monthly" as const,
      priority: 0.9,
      images: entry.hero ? [entry.hero] : undefined,
    })),
  ];
}
