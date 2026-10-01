import type { Metadata } from "next";
import Link from "next/link";
import { DataTable } from "@/components/admin/DataTable";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { buttonVariants } from "@/components/ui/button";
import { can, sectionAccess } from "@/features/auth/access";
import { getAtlas } from "@/features/geography/queries";

export const metadata: Metadata = { title: "Datové vrstvy" };

export default async function DataPage() {
  const access = await sectionAccess("layers");
  if (!access) return <NoAccess />;
  const { indicators } = await getAtlas();

  return (
    <>
      <PageHeader
        title="Datové vrstvy"
        lead="Ukazatele, které barví globus. Importované z Our World in Data jdou opravit ruční hodnotou se zdrojem; vlastní vrstvy založíte tady."
        actions={
          can(access.permissions, "layers", "c") ? (
            <Link href="/admin/data/novy" className={buttonVariants()}>
              Nový ukazatel
            </Link>
          ) : null
        }
      />
      <DataTable
        caption="Ukazatele"
        rows={indicators}
        rowKey={(indicator) => indicator.id}
        columns={[
          {
            key: "label",
            header: "Ukazatel",
            cell: (indicator) => (
              <Link href={`/admin/data/${indicator.id}`} className="font-medium hover:underline">
                {indicator.label}
              </Link>
            ),
          },
          {
            key: "type",
            header: "Druh",
            cell: (indicator) => (indicator.type === "categorical" ? "Kategorie" : "Škála"),
            wide: true,
          },
          { key: "source", header: "Zdroj", cell: (indicator) => indicator.source, wide: true },
          { key: "year", header: "Data z roku", cell: (indicator) => indicator.latestYear ?? "—" },
          { key: "count", header: "Zemí", cell: (indicator) => indicator.countryCount, end: true },
        ]}
      />
    </>
  );
}
