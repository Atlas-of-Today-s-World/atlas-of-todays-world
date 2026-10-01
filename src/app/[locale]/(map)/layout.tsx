import Header from "@/components/Header";
import AtlasGlobe, { type RegionLookup } from "@/components/map/AtlasGlobe";
import MapControls from "@/components/map/MapControls";
import { MapProvider } from "@/components/map/MapContext";
import { MapLegend, type ViewOption } from "@/components/map/ViewSwitcher";
import ContentRail from "@/components/ContentRail";
import { ErrorState } from "@/components/atlas/ErrorState";
import { getFlags } from "@/features/flags/queries";
import { regionColorMap } from "@/features/geography/model";
import { getAtlas } from "@/features/geography/queries";
import { format, type Messages } from "@/features/i18n/messages";
import { getT, localeFrom } from "@/features/i18n/request";
import type { GlobalIssue, Indicator, Region } from "@/features/geography/types";
import { saturate, saturateMap } from "@/lib/color";
import { colorMapFor, legendFor } from "@/lib/indicators";

/** Volby pro přepínač vrstev – generují se z importovaných indikátorů. */
function buildViewOptions(indicators: Indicator[], saturation: number, t: Messages): ViewOption[] {
  return [
    {
      id: "encyclopedia",
      label: t.map.encyclopediaView,
      shortLabel: t.map.encyclopediaView,
      caption: t.map.encyclopediaCaption,
      swatches: [],
    },
    ...indicators.map((indicator) => {
      const legend = legendFor(indicator);
      return {
        id: indicator.id,
        label: indicator.label,
        shortLabel: format(t.map.layerView, { label: indicator.shortLabel }),
        caption: legend.caption,
        swatches: legend.swatches.map((swatch) => ({
          ...swatch,
          color: saturate(swatch.color, saturation),
        })),
      };
    }),
  ];
}

/**
 * Mapový shell. Globus se montuje tady, takže přechod mezi úvodní mapou,
 * regionem, zemí a encyklopedickým heslem neznamená nové načtení mapy –
 * uživatel s ní nikdy neztratí kontakt.
 */
/** ISO3 → hodnota prvního celku, ve kterém země je (země může být ve více global issues). */
function firstByCountry<T>(
  groups: (Region | GlobalIssue)[],
  pick: (group: Region | GlobalIssue) => T,
) {
  const out: Record<string, T> = {};
  for (const group of groups) for (const iso3 of group.countries) out[iso3] ??= pick(group);
  return out;
}

/** Region nebo global issue → podklad pro zvýraznění celku na globusu. */
function lookup(groups: (Region | GlobalIssue)[]): RegionLookup {
  return {
    slugByCountry: firstByCountry(groups, (group) => group.slug),
    bySlug: Object.fromEntries(
      groups.map((group) => [group.slug, { name: group.name, countries: group.countries }]),
    ),
  };
}

export default async function MapLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const [atlas, flags] = await Promise.all([getAtlas(await localeFrom(params)), getFlags()]);
  const slugs = Object.fromEntries(atlas.countries.map((country) => [country.iso3, country.slug]));

  const colorSets: Record<string, Record<string, string>> = {
    encyclopedia: regionColorMap(atlas.regions),
    issue: firstByCountry(atlas.issues, (issue) => issue.fill),
  };
  for (const indicator of atlas.indicators) colorSets[indicator.id] = colorMapFor(indicator);
  // Sytost barev ze vzhledu webu (administrace → Vzhled mapy).
  for (const key of Object.keys(colorSets)) {
    colorSets[key] = saturateMap(colorSets[key], atlas.theme.saturation);
  }

  const regionLookup = lookup(atlas.regions);
  const issue = lookup(atlas.issues);
  const t = getT();
  const viewOptions = buildViewOptions(atlas.indicators, atlas.theme.saturation, t);
  const regionLabels = atlas.regions.map(({ slug, name, center }) => ({ slug, name, center }));

  return (
    <MapProvider>
      <main className="relative h-dvh w-full overflow-hidden bg-[var(--color-space-deep)]">
        <AtlasGlobe
          colorSets={colorSets}
          slugs={slugs}
          regions={regionLookup}
          issue={issue}
          regionLabels={regionLabels}
          styleOptions={{
            border: atlas.theme.border,
            areas: atlas.areas.map(({ slug, label, name, fill, stroke, geometry }) => ({
              slug,
              label: label || name,
              fill,
              stroke,
              geometry,
            })),
          }}
        />
        <Header newsletter={flags.newsletter} />
        <MapControls options={viewOptions} hasIssues={Object.keys(issue.bySlug).length > 0} />
        <MapLegend options={viewOptions} />
        {flags.maintenance ? (
          <ContentRail>
            <ErrorState
              code={t.map.maintenance}
              title={t.map.maintenanceTitle}
              lead={t.map.maintenanceText}
              backLabel={t.common.backToGlobe}
            />
          </ContentRail>
        ) : (
          children
        )}
      </main>
    </MapProvider>
  );
}
