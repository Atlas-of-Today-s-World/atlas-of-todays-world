import type { Metadata } from "next";
import Link from "next/link";
import { DataTable } from "@/components/admin/DataTable";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { buttonVariants } from "@/components/ui/button";
import { can, sectionAccess } from "@/features/auth/access";
import { listAuthors } from "@/features/authors/editorial";

export const metadata: Metadata = { title: "Authors" };

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
        title="Authors"
        lead="People who write encyclopedia entries. Each entry shows their photo, bio and positionality statement."
      />
      {can(access.permissions, "news", "c") ? (
        <Link href="/admin/authors/new" className={buttonVariants({ size: "sm" })}>
          Add author
        </Link>
      ) : null}

      <h2 className="font-display mt-10 mb-3 text-[18px] font-bold">List ({rows.length})</h2>
      <DataTable
        caption="Authors"
        rows={rows}
        rowKey={(row) => row.id}
        empty="No authors yet."
        columns={[
          {
            key: "name",
            header: "Name",
            cell: (row) => (
              <Link
                href={`/admin/authors/${row.id}`}
                className="font-medium text-[var(--color-link)] hover:underline"
              >
                {row.name}
              </Link>
            ),
          },
          {
            key: "positionality",
            header: "Positionality",
            cell: (row) => (row.positionality ? "filled in" : "missing"),
            wide: true,
          },
          {
            key: "photo",
            header: "Photo",
            cell: (row) => (row.photo_url ? "yes" : "no"),
            wide: true,
          },
        ]}
      />
    </>
  );
}
