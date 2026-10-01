import type { Metadata } from "next";
import Link from "next/link";
import { DataTable } from "@/components/admin/DataTable";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { buttonVariants } from "@/components/ui/button";
import { can, sectionAccess } from "@/features/auth/access";
import { listAuthors } from "@/features/authors/editorial";

export const metadata: Metadata = { title: "Autoři" };

/**
 * Autoři encyklopedických hesel (P9). Heslo ukazuje jejich fotku, životopis
 * a positionality statement; kdo smí co upravit, hlídá RLS (sekce news).
 */
export default async function AuthorsPage() {
  const access = await sectionAccess("news");
  if (!access) return <NoAccess />;
  const rows = await listAuthors();

  return (
    <>
      <PageHeader
        title="Autoři"
        lead="Lidé, kteří píší encyklopedická hesla. U hesla se ukáže jejich fotka, životopis a positionality statement."
      />
      {can(access.permissions, "news", "c") ? (
        <Link href="/admin/autori/novy" className={buttonVariants({ size: "sm" })}>
          Přidat autora
        </Link>
      ) : null}

      <h2 className="font-display mt-10 mb-3 text-[18px] font-bold">Seznam ({rows.length})</h2>
      <DataTable
        caption="Autoři"
        rows={rows}
        rowKey={(row) => row.id}
        empty="Zatím žádní autoři."
        columns={[
          {
            key: "name",
            header: "Jméno",
            cell: (row) => (
              <Link
                href={`/admin/autori/${row.id}`}
                className="font-medium text-[var(--color-link)] hover:underline"
              >
                {row.name}
              </Link>
            ),
          },
          {
            key: "positionality",
            header: "Positionality",
            cell: (row) => (row.positionality ? "vyplněno" : "chybí"),
            wide: true,
          },
          {
            key: "photo",
            header: "Fotka",
            cell: (row) => (row.photo_url ? "ano" : "ne"),
            wide: true,
          },
        ]}
      />
    </>
  );
}
