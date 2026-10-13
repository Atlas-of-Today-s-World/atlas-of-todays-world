import type { Metadata } from "next";
import Link from "next/link";
import { forbidden } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/data-table/DataTable";
import { RowActions } from "@/components/data-table/RowActions";
import { deleteAction, editAction, openAction } from "@/components/data-table/row-actions";
import { buttonVariants } from "@/components/ui/button";
import { navIcon } from "@/config/admin-nav";
import { adminRoutes, routes } from "@/config/routes";
import { can, sectionAccess } from "@/features/auth/access";
import { getAtlas } from "@/features/geography/queries";
import { deleteArea } from "@/features/map/actions";

export const metadata: Metadata = { title: "Custom map areas" };

export default async function AreasPage() {
  const access = await sectionAccess("areas");
  if (!access) forbidden();
  const { areas, countryByIso3 } = await getAtlas();
  const canDelete = can(access.permissions, "areas", "d");
  // An area has no page of its own; one tied to a country is seen on that country's
  // page (the globe turns there). Others are only on the globe as it spins.
  const countryOf = (area: (typeof areas)[number]) =>
    area.countryIso3 ? countryByIso3.get(area.countryIso3) : undefined;
  const anyOpen = areas.some((area) => countryOf(area));
  return (
    <>
      <PageHeader
        icon={navIcon(adminRoutes.areas.list)}
        title="Custom map areas"
        lead="Custom areas on the globe that don't follow state borders — occupied territories, river basins, front lines."
        actions={
          can(access.permissions, "areas", "c") ? (
            <Link href={adminRoutes.areas.new} className={buttonVariants({ size: "sm" })}>
              New map area
            </Link>
          ) : null
        }
      />
      <DataTable
        tableKey="admin-areas"
        caption="Custom map areas"
        emptyTitle="No custom map areas yet"
        initialSort={{ key: "name", dir: "asc" }}
        actionsWidth={`${(1 + (anyOpen ? 1 : 0) + (canDelete ? 1 : 0)) * 32 + 16}px`}
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
          { key: "country", label: "Country", sortable: true, filter: "select" },
          {
            key: "points",
            label: "Points",
            kind: "number",
            align: "right",
            sortable: true,
            width: "88px",
          },
        ]}
        rows={areas.map((area) => {
          const country = countryOf(area);
          return {
            id: area.slug,
            href: adminRoutes.areas(area.slug),
            values: {
              color: area.fill,
              name: area.name,
              label: area.label,
              country: country?.name ?? null,
              points: area.geometry.coordinates[0]?.length ?? 0,
            },
            actions: (
              <RowActions
                actions={[
                  editAction(adminRoutes.areas(area.slug)),
                  ...(country
                    ? [openAction(routes.country(country.slug), `Open ${country.name} on the site`)]
                    : []),
                  ...(canDelete
                    ? [deleteAction(deleteArea.bind(null, area.slug), `area ${area.name}`)]
                    : []),
                ]}
              />
            ),
          };
        })}
      />
    </>
  );
}
