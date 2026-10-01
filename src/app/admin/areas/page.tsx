import type { Metadata } from "next";
import Link from "next/link";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/data-table/DataTable";
import { RowActions } from "@/components/data-table/RowActions";
import { deleteAction, editAction } from "@/components/data-table/row-actions";
import { buttonVariants } from "@/components/ui/button";
import { navIcon } from "@/config/admin-nav";
import { can, sectionAccess } from "@/features/auth/access";
import { getAtlas } from "@/features/geography/queries";
import { deleteArea } from "@/features/map/actions";

export const metadata: Metadata = { title: "Map areas" };

export default async function AreasPage() {
  const access = await sectionAccess("areas");
  if (!access) return <NoAccess />;
  const { areas } = await getAtlas();
  const canDelete = can(access.permissions, "areas", "d");
  return (
    <>
      <PageHeader
        icon={navIcon("/admin/areas")}
        title="Map areas"
        lead="Custom areas on the globe that don't follow state borders — occupied territories, river basins, front lines."
        actions={
          can(access.permissions, "areas", "c") ? (
            <Link href="/admin/areas/new" className={buttonVariants({ size: "sm" })}>
              New area
            </Link>
          ) : null
        }
      />
      <DataTable
        tableKey="admin-areas"
        caption="Map areas"
        emptyTitle="No areas yet"
        initialSort={{ key: "name", dir: "asc" }}
        actionsWidth={canDelete ? "72px" : "48px"}
        columns={[
          { key: "color", label: "Colour", kind: "color", width: "64px", noExport: true },
          {
            key: "name",
            label: "Name",
            link: true,
            sortable: true,
            filter: "text",
            width: "minmax(200px, 2fr)",
          },
          { key: "label", label: "Map label", sortable: true, filter: "text" },
          {
            key: "points",
            label: "Points",
            kind: "number",
            align: "right",
            sortable: true,
            width: "88px",
          },
        ]}
        rows={areas.map((area) => ({
          id: area.slug,
          href: `/admin/areas/${area.slug}`,
          values: {
            color: area.fill,
            name: area.name,
            label: area.label,
            points: area.geometry.coordinates[0]?.length ?? 0,
          },
          actions: (
            <RowActions
              actions={[
                editAction(`/admin/areas/${area.slug}`),
                ...(canDelete
                  ? [deleteAction(deleteArea.bind(null, area.slug), `area ${area.name}`)]
                  : []),
              ]}
            />
          ),
        }))}
      />
    </>
  );
}
