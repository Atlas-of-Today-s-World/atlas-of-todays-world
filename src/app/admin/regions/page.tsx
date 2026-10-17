import type { Metadata } from "next";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/data-table/DataTable";
import { RowActions } from "@/components/data-table/RowActions";
import { editAction, moveActions, openAction } from "@/components/data-table/row-actions";
import { optionStats } from "@/components/data-table/stats";
import { navIcon } from "@/config/admin-nav";
import { can, sectionAccess } from "@/features/auth/access";
import { getAtlas } from "@/features/geography/queries";
import { moveRegion, setRegionProgress } from "@/features/portraits/actions";
import { RegionProgressSwitch } from "@/features/portraits/components/RegionProgressSwitch";
import { REGION_PROGRESS_LABEL } from "@/features/portraits/constants";
import { countriesWithProfileText } from "@/features/portraits/editorial";
import { formatPopulation } from "@/lib/format";
import { adminRoutes, routes } from "@/config/routes";

export const metadata: Metadata = { title: "Regions & countries" };

/** A region's content (regions.content_progress): the column's badge, filter and chips. */
const PROGRESS = [
  { value: "completed", label: REGION_PROGRESS_LABEL.completed, tone: "success" as const },
  { value: "planned", label: REGION_PROGRESS_LABEL.planned, tone: "warning" as const },
];

const PROFILE = [
  { value: "yes", label: "With editorial profile", tone: "success" as const },
  { value: "no", label: "No profile yet", tone: "neutral" as const },
];

export default async function RegionsPage() {
  const access = await sectionAccess("regions");
  if (!access) return <NoAccess />;
  const [atlas, withText] = await Promise.all([getAtlas(), countriesWithProfileText()]);
  // The globe's pills, the Countries page and the admin list follow this order.
  // Moving a region and switching its content need the same right.
  const canMove = can(access.permissions, "regions", "e");

  return (
    <>
      <PageHeader
        icon={navIcon(adminRoutes.regions.list)}
        title="Regions & countries"
        lead="Portraits of the Atlas's nine regions and editorial country profiles. Indicator values live in Map data layers."
      />
      <DataTable
        compact
        tableKey="admin-regions"
        caption="Regions"
        initialSort={{ key: "position", dir: "asc" }}
        stats={optionStats("progress", PROGRESS)}
        maxRowActions={canMove ? 4 : 2}
        columns={[
          {
            key: "position",
            label: "#",
            kind: "number",
            align: "right",
            sortable: true,
            width: "56px",
          },
          { key: "name", label: "Region", link: true, sortable: true, width: "minmax(200px, 2fr)" },
          {
            key: "progress",
            label: "Content",
            kind: "badge",
            options: PROGRESS,
            sortable: true,
            filter: "select",
            width: "200px",
          },
          {
            key: "countries",
            label: "Countries",
            kind: "number",
            align: "right",
            sortable: true,
            width: "112px",
          },
        ]}
        rows={atlas.regions.map((region, index) => ({
          id: region.slug,
          href: adminRoutes.regions(region.slug),
          values: {
            position: index + 1,
            name: region.name,
            progress: region.contentStatus,
            countries: region.countries.length,
          },
          cells: {
            progress: (
              <RegionProgressSwitch
                region={region.name}
                progress={region.contentStatus}
                disabled={!canMove}
                actions={{
                  planned: setRegionProgress.bind(null, region.slug, "planned"),
                  completed: setRegionProgress.bind(null, region.slug, "completed"),
                }}
              />
            ),
          },
          actions: (
            <RowActions
              actions={[
                editAction(adminRoutes.regions(region.slug)),
                openAction(routes.region(region.slug)),
                ...(canMove
                  ? moveActions(
                      moveRegion.bind(null, region.slug, true),
                      moveRegion.bind(null, region.slug, false),
                      { first: index === 0, last: index === atlas.regions.length - 1 },
                    )
                  : []),
              ]}
            />
          ),
        }))}
      />

      <h2 className="font-display mt-10 mb-3 text-[18px] font-bold">Country profiles</h2>
      <DataTable
        tableKey="admin-countries"
        caption="Countries"
        searchPlaceholder="Find a country…"
        emptyTitle="No countries"
        initialSort={{ key: "name", dir: "asc" }}
        initialFilters={{ profile: ["yes"] }}
        stats={optionStats("profile", PROFILE)}
        maxRowActions={2}
        columns={[
          {
            key: "name",
            label: "Country",
            link: true,
            sortable: true,
            filter: "text",
            width: "minmax(200px, 2fr)",
          },
          { key: "iso3", label: "ISO3", kind: "code", sortable: true, width: "80px" },
          { key: "region", label: "Region", sortable: true, filter: "select" },
          {
            key: "profile",
            label: "Profile",
            kind: "badge",
            options: PROFILE,
            sortable: true,
            filter: "select",
          },
          {
            key: "population",
            label: "Population",
            kind: "number",
            align: "right",
            sortable: true,
            width: "120px",
          },
        ]}
        rows={atlas.countries.map((country) => ({
          id: country.iso3,
          href: adminRoutes.country(country.slug),
          values: {
            name: country.name,
            iso3: country.iso3,
            region: country.region?.name ?? null,
            profile: withText.has(country.iso3) || country.profile.metrics.length ? "yes" : "no",
            population: country.population,
          },
          cells: { population: formatPopulation(country.population) },
          actions: (
            <RowActions
              actions={[
                editAction(adminRoutes.country(country.slug)),
                openAction(routes.country(country.slug)),
              ]}
            />
          ),
        }))}
      />
    </>
  );
}
