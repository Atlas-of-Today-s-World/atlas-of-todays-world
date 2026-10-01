import type { Metadata } from "next";
import Link from "next/link";
import { DataTable } from "@/components/admin/DataTable";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { buttonVariants } from "@/components/ui/button";
import { can, sectionAccess } from "@/features/auth/access";
import { getAtlas } from "@/features/geography/queries";

export const metadata: Metadata = { title: "Data layers" };

export default async function DataPage() {
  const access = await sectionAccess("layers");
  if (!access) return <NoAccess />;
  const { indicators } = await getAtlas();

  return (
    <>
      <PageHeader
        title="Data layers"
        lead="Indicators that color the globe. Values imported from Our World in Data can be corrected with a manual, sourced value; create custom layers here."
        actions={
          can(access.permissions, "layers", "c") ? (
            <Link href="/admin/data/new" className={buttonVariants()}>
              New indicator
            </Link>
          ) : null
        }
      />
      <DataTable
        caption="Indicators"
        rows={indicators}
        rowKey={(indicator) => indicator.id}
        columns={[
          {
            key: "label",
            header: "Indicator",
            cell: (indicator) => (
              <Link href={`/admin/data/${indicator.id}`} className="font-medium hover:underline">
                {indicator.label}
              </Link>
            ),
          },
          {
            key: "type",
            header: "Type",
            cell: (indicator) => (indicator.type === "categorical" ? "Categories" : "Scale"),
            wide: true,
          },
          { key: "source", header: "Source", cell: (indicator) => indicator.source, wide: true },
          { key: "year", header: "Data year", cell: (indicator) => indicator.latestYear ?? "—" },
          {
            key: "count",
            header: "Countries",
            cell: (indicator) => indicator.countryCount,
            end: true,
          },
        ]}
      />
    </>
  );
}
