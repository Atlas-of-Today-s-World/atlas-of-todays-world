import type { Metadata } from "next";
import Link from "next/link";
import { DataTable } from "@/components/admin/DataTable";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { Input } from "@/components/ui/field";
import { sectionAccess } from "@/features/auth/access";
import { getAtlas } from "@/features/geography/queries";
import { formatPopulation } from "@/lib/format";

export const metadata: Metadata = { title: "Regiony a země" };

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
        title="Regiony a země"
        lead="Portréty devíti regionů Atlasu a redakční profily zemí. Hodnoty ukazatelů jsou v Datových vrstvách."
      />
      <DataTable
        caption="Regiony"
        rows={atlas.regions}
        rowKey={(region) => region.slug}
        columns={[
          {
            key: "name",
            header: "Region",
            cell: (region) => (
              <Link href={`/admin/regiony/${region.slug}`} className="font-medium hover:underline">
                {region.name}
              </Link>
            ),
          },
          { key: "countries", header: "Zemí", cell: (region) => region.countries.length },
          {
            key: "link",
            header: "Na webu",
            end: true,
            cell: (region) => (
              <Link href={`/region/${region.slug}`} className="text-[var(--color-link)] underline">
                Otevřít
              </Link>
            ),
          },
        ]}
      />

      <h2 className="font-display mt-12 mb-3 text-[18px] font-bold">Profily zemí</h2>
      <form action="/admin/regiony" className="mb-4 flex max-w-sm gap-2">
        <label htmlFor="q" className="sr-only">
          Najít zemi
        </label>
        <Input id="q" name="q" type="search" placeholder="Najít zemi…" defaultValue={q} />
      </form>
      {!needle ? (
        <p className="mb-3 text-[13px] text-[var(--color-ink-muted)]">
          Níže jsou země s redakčním textem; ostatní najdete hledáním.
        </p>
      ) : null}
      <DataTable
        caption="Země"
        rows={countries}
        rowKey={(country) => country.iso3}
        empty="Žádná země neodpovídá."
        columns={[
          {
            key: "name",
            header: "Země",
            cell: (country) => (
              <Link
                href={`/admin/regiony/zeme/${country.slug}`}
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
            header: "Obyvatel",
            cell: (country) => formatPopulation(country.population),
            end: true,
          },
        ]}
      />
    </>
  );
}
