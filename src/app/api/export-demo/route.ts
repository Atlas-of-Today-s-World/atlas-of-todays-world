import { NextResponse } from "next/server";
import { REGIONS } from "@/data/regions";
import { indexableCountries, regionColorMap } from "@/lib/countries";
import { INDICATORS, colorMapFor, legendFor } from "@/lib/indicators";
import { allNews, regionDossier } from "@/lib/content";
import { allSpecialRegions, specialColorMap } from "@/lib/special-regions";

export const dynamic = "force-dynamic";

/**
 * Vybalí obsah Atlasu do jednoho JSON balíku pro samostatnou sdílenou
 * ukázku (artefakt), která běží bez serveru. Není součástí veřejného webu –
 * robots.txt má /api/ mimo index.
 */
export async function GET() {
  const newsItems = await allNews();
  const dossiers = Object.fromEntries(
    await Promise.all(
      REGIONS.map(async (region) => [region.slug, await regionDossier(region.slug)] as const),
    ),
  );

  const specials = await allSpecialRegions();

  const colorSets: Record<string, Record<string, string>> = {
    encyclopedia: regionColorMap(),
    special: await specialColorMap(),
  };
  for (const indicator of INDICATORS) {
    colorSets[indicator.id] = colorMapFor(indicator.id);
  }

  return NextResponse.json({
    regions: REGIONS.map((region) => ({
      id: region.id,
      slug: region.slug,
      name: region.name,
      tagline: region.tagline,
      fill: region.fill,
      stroke: region.stroke,
      center: region.center,
      zoom: region.zoom,
      summary: region.summary,
      countries: region.countries,
    })),
    countries: indexableCountries().map((country) => ({
      iso3: country.iso3,
      name: country.name,
      nameFormal: country.nameFormal,
      slug: country.slug,
      region: country.region?.slug ?? null,
      unSubregion: country.unSubregion,
      population: country.population,
      bbox: country.bbox,
      lon: country.labelLon,
      lat: country.labelLat,
      stats: country.stats.map((stat) => ({
        id: stat.id,
        label: stat.label,
        value: stat.value,
        year: stat.year,
        rank: stat.rank,
        rankOf: stat.rankOf,
        source: stat.source,
      })),
    })),
    views: [
      {
        id: "encyclopedia",
        label: "Encyclopedia view",
        short: "Encyclopedia view",
        caption: "World regions of the Atlas · click any country to open its profile",
        swatches: [],
      },
      ...INDICATORS.map((indicator) => {
        const legend = legendFor(indicator);
        return {
          id: indicator.id,
          label: indicator.label,
          short: `${indicator.shortLabel} view`,
          caption: legend.caption,
          swatches: legend.swatches,
        };
      }),
    ],
    colorSets,
    dossiers,
    specials,
    newsItems: newsItems.map((item) => ({
      slug: item.slug,
      title: item.title,
      summary: item.summary,
      category: item.category,
      region: item.region,
      countries: item.countries ?? [],
      published: item.published ?? null,
      author: item.author ?? null,
      readingMinutes: item.readingMinutes ?? null,
      html: item.html,
    })),
  });
}
