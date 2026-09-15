import Header from "@/components/Header";
import type { HotNewsItem } from "@/components/HotNews";
import AtlasGlobe, { type RegionLookup } from "@/components/map/AtlasGlobe";
import MapControls from "@/components/map/MapControls";
import { MapProvider } from "@/components/map/MapContext";
import { MapLegend, type ViewOption } from "@/components/map/ViewSwitcher";
import { REGIONS } from "@/data/regions";
import { allNews } from "@/lib/content";
import { countryByIso3, indexableCountries, regionColorMap } from "@/lib/countries";
import { INDICATORS, colorMapFor, legendFor } from "@/lib/indicators";
import { specialColorMap, specialLookup } from "@/lib/special-regions";

/** Osm nejnovějších novinek pro blok Hot News. */
async function buildHotNews(): Promise<HotNewsItem[]> {
  const newsItems = await allNews();
  return newsItems.slice(0, 8).map((item) => {
    // Novinka o jedné zemi nese jméno země, jinak region; bez obojího je to téma.
    const onlyCountry =
      item.countries?.length === 1 ? countryByIso3(item.countries[0]) : null;
    if (onlyCountry) {
      return {
        slug: item.slug,
        title: item.title,
        scope: onlyCountry.name,
        scopeKind: "country" as const,
        published: item.published ?? null,
        hero: item.hero,
      };
    }
    return {
      slug: item.slug,
      title: item.title,
      scope: item.regionRef?.name ?? item.category,
      scopeKind: item.regionRef ? ("region" as const) : ("topic" as const),
      published: item.published ?? null,
      hero: item.hero,
    };
  });
}

/** Volby pro přepínač vrstev – generují se z importovaných indikátorů. */
function buildViewOptions(): ViewOption[] {
  return [
    {
      id: "encyclopedia",
      label: "Encyclopedia view",
      shortLabel: "Encyclopedia view",
      caption: "World regions of the Atlas · click any country to open its profile",
      swatches: [],
    },
    ...INDICATORS.map((indicator) => {
      const legend = legendFor(indicator);
      return {
        id: indicator.id,
        label: indicator.label,
        shortLabel: `${indicator.shortLabel} view`,
        caption: legend.caption,
        swatches: legend.swatches,
      };
    }),
  ];
}

/**
 * Mapový shell. Globus se montuje tady, takže přechod mezi úvodní mapou,
 * regionem, zemí a encyklopedickým heslem neznamená nové načtení mapy –
 * uživatel s ní nikdy neztratí kontakt.
 */
export default async function MapLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const slugs = Object.fromEntries(
    indexableCountries().map((country) => [country.iso3, country.slug]),
  );

  const colorSets: Record<string, Record<string, string>> = {
    encyclopedia: regionColorMap(),
  };
  for (const indicator of INDICATORS) {
    colorSets[indicator.id] = colorMapFor(indicator.id);
  }

  const regionLookup: RegionLookup = {
    slugByCountry: Object.fromEntries(
      REGIONS.flatMap((region) =>
        region.countries.map((iso3) => [iso3, region.slug]),
      ),
    ),
    bySlug: Object.fromEntries(
      REGIONS.map((region) => [
        region.slug,
        { name: region.name, countries: region.countries },
      ]),
    ),
  };

  const viewOptions = buildViewOptions();
  const [hotNews, special, specialColors] = await Promise.all([
    buildHotNews(),
    specialLookup(),
    specialColorMap(),
  ]);
  colorSets.special = specialColors;

  return (
    <MapProvider>
      <main className="relative h-dvh w-full overflow-hidden bg-[var(--color-space-deep)]">
        <AtlasGlobe
          colorSets={colorSets}
          slugs={slugs}
          regions={regionLookup}
          special={special}
        />
        <Header />
        <MapControls
          options={viewOptions}
          hotNews={hotNews}
          hasSpecial={Object.keys(special.bySlug).length > 0}
        />
        <MapLegend options={viewOptions} />
        {children}
      </main>
    </MapProvider>
  );
}
