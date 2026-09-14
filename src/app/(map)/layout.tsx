import Header from "@/components/Header";
import type { HotNewsItem } from "@/components/HotNews";
import AtlasGlobe, { type RegionLookup } from "@/components/map/AtlasGlobe";
import MapControls from "@/components/map/MapControls";
import { MapProvider } from "@/components/map/MapContext";
import { MapLegend, type ViewOption } from "@/components/map/ViewSwitcher";
import { REGIONS } from "@/data/regions";
import { allEntries } from "@/lib/content";
import { countryByIso3, indexableCountries, regionColorMap } from "@/lib/countries";
import { INDICATORS, colorMapFor, legendFor } from "@/lib/indicators";

/** Osm nejnovějších hesel pro blok Hot News. */
async function buildHotNews(): Promise<HotNewsItem[]> {
  const entries = await allEntries();
  return entries.slice(0, 8).map((entry) => {
    // Heslo o jedné zemi nese jméno země, jinak region; bez obojího je to téma.
    const onlyCountry =
      entry.countries?.length === 1 ? countryByIso3(entry.countries[0]) : null;
    if (onlyCountry) {
      return {
        slug: entry.slug,
        title: entry.title,
        scope: onlyCountry.name,
        scopeKind: "country" as const,
        published: entry.published ?? null,
        hero: entry.hero,
      };
    }
    return {
      slug: entry.slug,
      title: entry.title,
      scope: entry.regionRef?.name ?? entry.category,
      scopeKind: entry.regionRef ? ("region" as const) : ("topic" as const),
      published: entry.published ?? null,
      hero: entry.hero,
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
  const hotNews = await buildHotNews();

  return (
    <MapProvider>
      <main className="relative h-dvh w-full overflow-hidden bg-[var(--color-space-deep)]">
        <AtlasGlobe colorSets={colorSets} slugs={slugs} regions={regionLookup} />
        <Header />
        <MapControls options={viewOptions} hotNews={hotNews} />
        <MapLegend options={viewOptions} />
        {children}
      </main>
    </MapProvider>
  );
}
