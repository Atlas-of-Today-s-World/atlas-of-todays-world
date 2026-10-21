// MapLibre's stylesheet only where the globe lives (83 kB of it, mostly control
// icons): before, every page — admin included — loaded it as render-blocking CSS.
import "maplibre-gl/dist/maplibre-gl.css";
import Header from "@/components/Header";
import AtlasGlobe, { type RegionLookup } from "@/components/map/AtlasGlobe";
import MapControls from "@/components/map/MapControls";
import { latestEntries } from "@/features/topics/featured";
import { MapStage } from "@/components/map/MapStage";
import { MapProvider } from "@/components/map/MapContext";
import { MapLegend, type ViewOption } from "@/components/map/ViewSwitcher";
import { PillLegend } from "@/components/map/PillLegend";
import { FloatingActions } from "@/components/membership/FloatingActions";
import { MaintenanceGate } from "@/components/MaintenanceGate";
import { getFlags } from "@/features/flags/queries";
import { getNavigation } from "@/features/navigation/queries";
import { getSocialLinks } from "@/features/site/queries";
import { regionColorMap } from "@/features/geography/model";
import { getAtlas } from "@/features/geography/queries";
import { getPlannedTopics, getTopicPlaces } from "@/features/entries/queries";
import {
  badgeNumbers,
  countryBadges,
  countTopics,
  plannedPlaces,
} from "@/features/topics/map-counts";
import { format, type Messages } from "@/lib/i18n/messages";
import { getRequestLocale, getT, localeFrom } from "@/lib/i18n/request";
import type { GlobalIssue, Indicator, Region } from "@/features/geography/types";
import { saturate, saturateMap } from "@/lib/color";
import { legendFor } from "@/features/geography/indicators";
import { captchaEnabled } from "@/lib/security/turnstile";

/** Options for the layer switcher – generated from imported indicators. */
function buildViewOptions(indicators: Indicator[], saturation: number, t: Messages): ViewOption[] {
  return [
    {
      id: "encyclopedia",
      // Default: no indicator, the globe shows the Atlas regions. The button then reads "World metrics".
      label: t.map.noMetric,
      shortLabel: t.map.encyclopediaView,
      caption: "",
      swatches: [],
    },
    ...indicators.map((indicator) => {
      const legend = legendFor(indicator, getRequestLocale(), t.ui.source);
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
 * Map shell. The globe is mounted here, so moving between the home map,
 * a region, a country and an encyclopedia entry doesn't reload the map –
 * the user never loses touch with it.
 */
/** ISO3 → value of the first group containing the country (a country can be in several global issues). */
function firstByCountry<T>(
  groups: (Region | GlobalIssue)[],
  pick: (group: Region | GlobalIssue) => T,
) {
  const out: Record<string, T> = {};
  for (const group of groups) for (const iso3 of group.countries) out[iso3] ??= pick(group);
  return out;
}

/** Region or global issue → data for highlighting the group on the globe. */
function lookup(groups: (Region | GlobalIssue)[]): RegionLookup {
  return {
    slugByCountry: firstByCountry(groups, (group) => group.slug),
    bySlug: Object.fromEntries(
      groups.map((group) => [
        group.slug,
        {
          name: group.name,
          countries: group.countries,
          fill: group.fill,
          status: group.contentStatus,
        },
      ]),
    ),
  };
}

export default async function MapLayout({ children, params }: LayoutProps<"/[locale]">) {
  const [atlas, flags, places, planned, featured, socials, nav] = await Promise.all([
    getAtlas(await localeFrom(params)),
    getFlags(),
    getTopicPlaces(),
    // Best effort: without the plan the pills read published / published.
    getPlannedTopics().catch(() => []),
    latestEntries(),
    getSocialLinks(),
    getNavigation(),
  ]);
  const slugs = Object.fromEntries(atlas.countries.map((country) => [country.iso3, country.slug]));

  // Only the two always-on layers travel with the page; each metric's colours and
  // values come from /api/globe-layer/[id] once it is switched on (they were
  // ~70 kB of every map page's HTML).
  const colorSets: Record<string, Record<string, string>> = {
    encyclopedia: regionColorMap(atlas.regions),
    issue: firstByCountry(atlas.issues, (issue) => issue.fill),
  };
  // Sytost barev ze vzhledu webu (administrace → Vzhled mapy).
  for (const [key, colors] of Object.entries(colorSets)) {
    colorSets[key] = saturateMap(colors, atlas.theme.saturation);
  }

  const regionLookup = lookup(atlas.regions);
  const issue = lookup(atlas.issues);
  const t = await getT();
  const viewOptions = buildViewOptions(atlas.indicators, atlas.theme.saturation, t);
  const regionLabels = atlas.regions.map(({ slug, name, center }) => ({ slug, name, center }));
  // Topic counts over places (ADR-024): computed here once, the globe only draws them.
  const regionOf = Object.fromEntries(atlas.countries.map((c) => [c.iso3, c.region?.slug]));
  const counts = countTopics(places, { regionOf, issues: atlas.issues });
  const topicCounts = {
    // A country shows its region's count, the only number under its name.
    countries: countryBadges(counts.regions, regionOf),
    regions: badgeNumbers(counts.regions),
    issue: badgeNumbers(counts.issues),
  };
  // The region's whole entry plan (published and planned topics), the "/ 10" of
  // the region and country pills: counted by the same rules as the published ones.
  const plan = countTopics([...places, ...plannedPlaces(planned)], {
    regionOf,
    issues: atlas.issues,
  });
  const topicTotals = {
    countries: countryBadges(plan.regions, regionOf),
    regions: badgeNumbers(plan.regions),
  };

  return (
    <MapProvider>
      <main className="relative h-dvh w-full overflow-hidden bg-[var(--color-space-deep)]">
        <Header
          newsletter={flags.newsletter}
          captcha={captchaEnabled()}
          nav={nav}
          socials={socials}
        />
        <FloatingActions onMap newsletter={flags.newsletter} />
        <MapStage>
          <AtlasGlobe
            colorSets={colorSets}
            slugs={slugs}
            regions={regionLookup}
            issue={issue}
            regionLabels={regionLabels}
            topicCounts={topicCounts}
            topicTotals={topicTotals}
            styleOptions={{
              border: atlas.theme.border,
              issueLabels: atlas.issues.map(({ slug, name, center }) => ({ slug, name, center })),
              areas: atlas.areas.map(({ slug, label, name, fill, stroke, geometry }) => ({
                slug,
                label: label || name,
                fill,
                stroke,
                geometry,
              })),
            }}
          />
          <MapControls
            options={viewOptions}
            issues={atlas.issues.map(({ slug, name, contentStatus, hero, fill }) => ({
              slug,
              name,
              topics: topicCounts.issue[slug] ?? 0,
              status: contentStatus,
              hero,
              fill,
            }))}
            featured={featured.map(({ region, issue, ...entry }) => ({
              ...entry,
              kicker:
                atlas.regionBySlug.get(region ?? "")?.name ??
                atlas.issueBySlug.get(issue ?? "")?.name,
            }))}
          />
          <MapLegend options={viewOptions} />
          <PillLegend options={viewOptions} />
          <MaintenanceGate inRail>{children}</MaintenanceGate>
        </MapStage>
      </main>
    </MapProvider>
  );
}
