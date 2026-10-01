import type { Metadata } from "next";
import Link from "next/link";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/data-table/DataTable";
import { RowActions } from "@/components/data-table/RowActions";
import { editAction, openAction } from "@/components/data-table/row-actions";
import { optionStats } from "@/components/data-table/stats";
import { buttonVariants } from "@/components/ui/button";
import { navIcon } from "@/config/admin-nav";
import { can, sectionAccess } from "@/features/auth/access";
import { getAtlas } from "@/features/geography/queries";

export const metadata: Metadata = { title: "Map data layers" };

const TYPES = [
  { value: "sequential", label: "Scale", tone: "accent" as const },
  { value: "categorical", label: "Categories", tone: "neutral" as const },
];

export default async function DataPage() {
  const access = await sectionAccess("layers");
  if (!access) return <NoAccess />;
  const { indicators } = await getAtlas();

  return (
    <>
      <PageHeader
        icon={navIcon("/admin/data")}
        title="Map data layers"
        lead="Indicators that color the globe — each one is a map data layer. Values imported from Our World in Data can be corrected with a manual, sourced value; create custom layers here."
        actions={
          can(access.permissions, "layers", "c") ? (
            <Link href="/admin/data/new" className={buttonVariants({ size: "sm" })}>
              New indicator
            </Link>
          ) : null
        }
      />
      <DataTable
        tableKey="admin-indicators"
        caption="Indicators"
        emptyTitle="No indicators yet"
        initialSort={{ key: "label", dir: "asc" }}
        stats={optionStats("type", TYPES)}
        actionsWidth="64px"
        columns={[
          {
            key: "label",
            label: "Indicator",
            link: true,
            sortable: true,
            filter: "text",
            width: "minmax(240px, 3fr)",
          },
          {
            key: "type",
            label: "Kind",
            kind: "badge",
            options: TYPES,
            sortable: true,
            filter: "select",
            width: "120px",
          },
          { key: "source", label: "Source", sortable: true, filter: "select" },
          { key: "unit", label: "Unit", sortable: true, hidden: true },
          {
            key: "year",
            label: "Data year",
            kind: "number",
            align: "right",
            sortable: true,
            width: "104px",
          },
          {
            key: "count",
            label: "Countries",
            kind: "number",
            align: "right",
            sortable: true,
            width: "104px",
          },
        ]}
        rows={indicators.map((indicator) => ({
          id: indicator.id,
          href: `/admin/data/${indicator.id}`,
          values: {
            label: indicator.label,
            type: indicator.type,
            source: indicator.source,
            unit: indicator.unit,
            // Rok bez oddělovače tisíců (2024, ne 2,024).
            year: indicator.latestYear ? String(indicator.latestYear) : null,
            count: indicator.countryCount,
          },
          actions: (
            <RowActions
              actions={[
                editAction(`/admin/data/${indicator.id}`),
                openAction(`/view/${indicator.id}`),
              ]}
            />
          ),
        }))}
      />
    </>
  );
}
