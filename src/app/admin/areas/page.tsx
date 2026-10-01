import type { Metadata } from "next";
import Link from "next/link";
import { DataTable } from "@/components/admin/DataTable";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { buttonVariants } from "@/components/ui/button";
import { can, sectionAccess } from "@/features/auth/access";
import { getAtlas } from "@/features/geography/queries";

export const metadata: Metadata = { title: "Map areas" };

export default async function AreasPage() {
  const access = await sectionAccess("areas");
  if (!access) return <NoAccess />;
  const { areas } = await getAtlas();
  return (
    <>
      <PageHeader
        title="Map areas"
        lead="Custom areas on the globe that don't follow state borders — occupied territories, river basins, front lines."
        actions={
          can(access.permissions, "areas", "c") ? (
            <Link href="/admin/areas/new" className={buttonVariants()}>
              New area
            </Link>
          ) : null
        }
      />
      <DataTable
        caption="Areas"
        rows={areas}
        rowKey={(area) => area.slug}
        empty="No areas yet."
        columns={[
          {
            key: "color",
            header: "",
            cell: (area) => (
              <span
                aria-hidden
                className="block size-4 rounded"
                style={{ background: area.fill, outline: `2px solid ${area.stroke}` }}
              />
            ),
          },
          {
            key: "name",
            header: "Name",
            cell: (area) => (
              <Link href={`/admin/areas/${area.slug}`} className="font-medium hover:underline">
                {area.name}
              </Link>
            ),
          },
          {
            key: "points",
            header: "Points",
            end: true,
            cell: (area) => area.geometry.coordinates[0]?.length ?? 0,
          },
        ]}
      />
    </>
  );
}
