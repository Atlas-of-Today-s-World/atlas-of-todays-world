import type { Metadata } from "next";
import Link from "next/link";
import { DataTable } from "@/components/admin/DataTable";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { Input } from "@/components/ui/field";
import { sectionAccess } from "@/features/auth/access";
import { getAtlas } from "@/features/geography/queries";
import { formatPopulation } from "@/lib/format";

export const metadata: Metadata = { title: "Regions & countries" };

export default async function RegionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  if (!(await sectionAccess("regions"))) return <NoAccess />;
  const { q } = await searchParams;
  const atlas = await getAtlas();
  const needle = q?.trim().toLowerCase() ?? "";
  const countries = needle
    ? atlas.countries.filter(
        (country) =>
          country.name.toLowerCase().includes(needle) || country.iso3.toLowerCase() === needle,
      )
    : atlas.countries.filter((country) => country.profile.html || country.profile.metrics.length);

  return (
    <>
      <PageHeader
        title="Regions & countries"
        lead="Portraits of the Atlas's nine regions and editorial country profiles. Indicator values live in Data layers."
      />
      <DataTable
        caption="Regions"
        rows={atlas.regions}
        rowKey={(region) => region.slug}
        columns={[
          {
            key: "name",
            header: "Region",
            cell: (region) => (
              <Link href={`/admin/regions/${region.slug}`} className="font-medium hover:underline">
                {region.name}
              </Link>
            ),
          },
          { key: "countries", header: "Countries", cell: (region) => region.countries.length },
          {
            key: "link",
            header: "On site",
            end: true,
            cell: (region) => (
              <Link href={`/region/${region.slug}`} className="text-[var(--color-link)] underline">
                Open
              </Link>
            ),
          },
        ]}
      />

      <h2 className="font-display mt-12 mb-3 text-[18px] font-bold">Country profiles</h2>
      <form action="/admin/regions" className="mb-4 flex max-w-sm gap-2">
        <label htmlFor="q" className="sr-only">
          Find a country
        </label>
        <Input id="q" name="q" type="search" placeholder="Find a country…" defaultValue={q} />
      </form>
      {!needle ? (
        <p className="mb-3 text-[13px] text-[var(--color-ink-muted)]">
          Below are countries with editorial text; search to find the others.
        </p>
      ) : null}
      <DataTable
        caption="Countries"
        rows={countries}
        rowKey={(country) => country.iso3}
        empty="No matching countries."
        columns={[
          {
            key: "name",
            header: "Country",
            cell: (country) => (
              <Link
                href={`/admin/regions/countries/${country.slug}`}
                className="font-medium hover:underline"
              >
                {country.name}
              </Link>
            ),
          },
          {
            key: "region",
            header: "Region",
            cell: (country) => country.region?.name ?? "—",
            wide: true,
          },
          {
            key: "population",
            header: "Population",
            cell: (country) => formatPopulation(country.population),
            end: true,
          },
        ]}
      />
    </>
  );
}
