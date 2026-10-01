import type { Metadata } from "next";
import Link from "next/link";
import { DataTable } from "@/components/admin/DataTable";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { buttonVariants } from "@/components/ui/button";
import { can, sectionAccess } from "@/features/auth/access";
import { getAtlas } from "@/features/geography/queries";

export const metadata: Metadata = { title: "Mapové oblasti" };

export default async function AreasPage() {
  const access = await sectionAccess("areas");
  if (!access) return <NoAccess />;
  const { areas } = await getAtlas();
  return (
    <>
      <PageHeader
        title="Mapové oblasti"
        lead="Vlastní plochy na globusu, které nesledují hranice států — okupovaná území, povodí, fronty."
        actions={
          can(access.permissions, "areas", "c") ? (
            <Link href="/admin/oblasti/nova" className={buttonVariants()}>
              Nová plocha
            </Link>
          ) : null
        }
      />
      <DataTable
        caption="Plochy"
        rows={areas}
        rowKey={(area) => area.slug}
        empty="Zatím žádná plocha."
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
            header: "Název",
            cell: (area) => (
              <Link href={`/admin/oblasti/${area.slug}`} className="font-medium hover:underline">
                {area.name}
              </Link>
            ),
          },
          {
            key: "points",
            header: "Bodů",
            end: true,
            cell: (area) => area.geometry.coordinates[0]?.length ?? 0,
          },
        ]}
      />
    </>
  );
}
