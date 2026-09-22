import Header from "@/components/Header";
import AtlasGlobe, { type RegionLookup } from "@/components/map/AtlasGlobe";
import MapControls from "@/components/map/MapControls";
import { MapProvider } from "@/components/map/MapContext";
import { MapLegend, type ViewOption } from "@/components/map/ViewSwitcher";
import { REGIONS } from "@/data/regions";
import { allNews } from "@/lib/content";
import { countryByIso3, indexableCountries, regionColorMap } from "@/lib/countries";
import { INDICATORS, colorMapFor, legendFor } from "@/lib/indicators";
import { issueColorMap, issueLookup } from "@/lib/global-issues";

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
  const [issue, issueColors] = await Promise.all([
    issueLookup(),
    issueColorMap(),
  ]);
  colorSets.issue = issueColors;

  return (
    <MapProvider>
      <main className="relative h-dvh w-full overflow-hidden bg-[var(--color-space-deep)]">
        <AtlasGlobe
          colorSets={colorSets}
          slugs={slugs}
          regions={regionLookup}
          issue={issue}
        />
        <Header />
        <MapControls
          options={viewOptions}
          hasIssues={Object.keys(issue.bySlug).length > 0}
        />
        <MapLegend options={viewOptions} />
        {children}
      </main>
    </MapProvider>
  );
}
