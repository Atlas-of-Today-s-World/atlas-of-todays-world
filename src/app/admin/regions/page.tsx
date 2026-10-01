import type { Metadata } from "next";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/data-table/DataTable";
import { RowActions } from "@/components/data-table/RowActions";
import { editAction, openAction } from "@/components/data-table/row-actions";
import { optionStats } from "@/components/data-table/stats";
import { navIcon } from "@/config/admin-nav";
import { sectionAccess } from "@/features/auth/access";
import { getAtlas } from "@/features/geography/queries";
import { formatPopulation } from "@/lib/format";

export const metadata: Metadata = { title: "Regions & countries" };

const PROFILE = [
  { value: "yes", label: "With editorial profile", tone: "success" as const },
  { value: "no", label: "No profile yet", tone: "neutral" as const },
];

export default async function RegionsPage() {
  if (!(await sectionAccess("regions"))) return <NoAccess />;
  const atlas = await getAtlas();

  return (
    <>
      <PageHeader
        icon={navIcon("/admin/regions")}
        title="Regions & countries"
        lead="Portraits of the Atlas's nine regions and editorial country profiles. Indicator values live in Data layers."
      />
      <DataTable
        compact
        tableKey="admin-regions"
        caption="Regions"
        actionsWidth="72px"
        columns={[
          { key: "name", label: "Region", link: true, sortable: true, width: "minmax(200px, 2fr)" },
          {
            key: "countries",
            label: "Countries",
            kind: "number",
            align: "right",
            sortable: true,
            width: "112px",
          },
        ]}
        rows={atlas.regions.map((region) => ({
          id: region.slug,
          href: `/admin/regions/${region.slug}`,
          values: { name: region.name, countries: region.countries.length },
          actions: (
            <RowActions
              actions={[
                editAction(`/admin/regions/${region.slug}`),
                openAction(`/region/${region.slug}`),
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
        actionsWidth="72px"
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
          href: `/admin/regions/countries/${country.slug}`,
          values: {
            name: country.name,
            iso3: country.iso3,
            region: country.region?.name ?? null,
            profile: country.profile.html || country.profile.metrics.length ? "yes" : "no",
            population: country.population,
          },
          cells: { population: formatPopulation(country.population) },
          actions: (
            <RowActions
              actions={[
                editAction(`/admin/regions/countries/${country.slug}`),
                openAction(`/country/${country.slug}`),
              ]}
            />
          ),
        }))}
      />
    </>
  );
}
