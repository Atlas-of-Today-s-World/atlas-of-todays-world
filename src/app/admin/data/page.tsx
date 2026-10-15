import type { Metadata } from "next";
import Link from "next/link";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/data-table/DataTable";
import { RowActions } from "@/components/data-table/RowActions";
import {
  deleteAction,
  editAction,
  moveActions,
  openAction,
} from "@/components/data-table/row-actions";
import { optionStats } from "@/components/data-table/stats";
import { buttonVariants } from "@/components/ui/button";
import { navIcon } from "@/config/admin-nav";
import { can, sectionAccess } from "@/features/auth/access";
import { getIndicators } from "@/features/geography/queries";
import { deleteIndicator, moveIndicator } from "@/features/indicators/actions";
import { customIndicatorIds } from "@/features/indicators/editorial";
import { adminRoutes, routes } from "@/config/routes";

export const metadata: Metadata = { title: "Map data layers" };

const TYPES = [
  { value: "sequential", label: "Scale", tone: "accent" as const },
  { value: "categorical", label: "Categories", tone: "neutral" as const },
];

export default async function DataPage() {
  const access = await sectionAccess("layers");
  if (!access) return <NoAccess />;
  const [indicators, custom] = await Promise.all([getIndicators(), customIndicatorIds()]);
  // The layer switcher, legends and country cards follow this order.
  const canMove = can(access.permissions, "layers", "e");
  const canDelete = can(access.permissions, "layers", "d");
  // Edit, open, up, down, delete — ~32 px per icon.
  const icons = 2 + (canMove ? 2 : 0) + (canDelete && custom.size ? 1 : 0);

  return (
    <>
      <PageHeader
        icon={navIcon(adminRoutes.data.list)}
        title="Map data layers"
        lead="Indicators that color the globe — each one is a map data layer. Values imported from Our World in Data can be corrected with a manual, sourced value; create custom layers here."
        actions={
          can(access.permissions, "layers", "c") ? (
            <Link href={adminRoutes.data.new} className={buttonVariants({ size: "sm" })}>
              New indicator
            </Link>
          ) : null
        }
      />
      <DataTable
        tableKey="admin-indicators"
        caption="Indicators"
        emptyTitle="No indicators yet"
        initialSort={{ key: "position", dir: "asc" }}
        stats={optionStats("type", TYPES)}
        actionsWidth={`${icons * 32}px`}
        columns={[
          {
            key: "position",
            label: "#",
            kind: "number",
            align: "right",
            sortable: true,
            width: "56px",
          },
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
        rows={indicators.map((indicator, index) => ({
          id: indicator.id,
          href: adminRoutes.data(indicator.id),
          values: {
            position: index + 1,
            label: indicator.label,
            type: indicator.type,
            source: indicator.source,
            unit: indicator.unit,
            // Year without a thousands separator (2024, not 2,024).
            year: indicator.latestYear ? String(indicator.latestYear) : null,
            count: indicator.countryCount,
          },
          actions: (
            <RowActions
              actions={[
                editAction(adminRoutes.data(indicator.id)),
                openAction(routes.view(indicator.id)),
                ...(canMove
                  ? moveActions(
                      moveIndicator.bind(null, indicator.id, true),
                      moveIndicator.bind(null, indicator.id, false),
                      { first: index === 0, last: index === indicators.length - 1 },
                    )
                  : []),
                // Imported layers come back with the next import; only custom ones go.
                ...(canDelete && custom.has(indicator.id)
                  ? [
                      deleteAction(
                        deleteIndicator.bind(null, indicator.id),
                        `the layer “${indicator.label}”`,
                        "Its values go with it and it disappears from the map. This cannot be undone.",
                      ),
                    ]
                  : []),
              ]}
            />
          ),
        }))}
      />
    </>
  );
}
