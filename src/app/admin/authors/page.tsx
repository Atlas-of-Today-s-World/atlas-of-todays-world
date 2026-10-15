import type { Metadata } from "next";
import Link from "next/link";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/data-table/DataTable";
import { RowActions } from "@/components/data-table/RowActions";
import { deleteAction, editAction, openAction } from "@/components/data-table/row-actions";
import { buttonVariants } from "@/components/ui/button";
import { navIcon } from "@/config/admin-nav";
import { adminRoutes, routes } from "@/config/routes";
import { can, sectionAccess } from "@/features/auth/access";
import { deleteAuthor } from "@/features/authors/actions";
import { listAuthors } from "@/features/authors/editorial";

export const metadata: Metadata = { title: "Author profiles" };

const DONE = [
  { value: "yes", label: "Filled in", tone: "success" as const },
  { value: "no", label: "Missing", tone: "warning" as const },
];

/**
 * Authors of encyclopedia entries (P9). An entry shows their photo, bio
 * and positionality statement; who may edit what is guarded by RLS (news section).
 */
export default async function AuthorsPage() {
  const access = await sectionAccess("news");
  if (!access) return <NoAccess />;
  const rows = await listAuthors();
  const canDelete = can(access.permissions, "news", "d");

  return (
    <>
      <PageHeader
        icon={navIcon(adminRoutes.authors.list)}
        title="Author profiles"
        lead="Public profiles of the people who write encyclopedia entries. Each entry shows its author's photo, bio and positionality statement."
        actions={
          can(access.permissions, "news", "c") ? (
            <Link href={adminRoutes.authors.new} className={buttonVariants({ size: "sm" })}>
              Add author profile
            </Link>
          ) : null
        }
      />
      <DataTable
        tableKey="admin-authors"
        caption="Authors"
        emptyTitle="No author profiles yet"
        initialSort={{ key: "name", dir: "asc" }}
        stats={[
          { key: "all", label: "All" },
          {
            key: "missing",
            label: "Missing positionality",
            tone: "warning",
            column: "positionality",
            value: "no",
          },
        ]}
        actionsWidth={canDelete ? "104px" : "72px"}
        columns={[
          {
            key: "name",
            label: "Name",
            link: true,
            sortable: true,
            filter: "text",
            width: "minmax(200px, 2fr)",
          },
          {
            key: "positionality",
            label: "Positionality",
            kind: "badge",
            options: DONE,
            filter: "select",
            sortable: true,
          },
          {
            key: "bio",
            label: "Bio",
            kind: "badge",
            options: DONE,
            filter: "select",
            sortable: true,
          },
          {
            key: "photo",
            label: "Photo",
            kind: "badge",
            options: DONE,
            filter: "select",
            sortable: true,
          },
        ]}
        rows={rows.map((row) => ({
          id: row.id,
          href: adminRoutes.authors(row.id),
          values: {
            name: row.name,
            positionality: row.positionality ? "yes" : "no",
            bio: row.bio ? "yes" : "no",
            photo: row.photo_url ? "yes" : "no",
          },
          actions: (
            <RowActions
              actions={[
                editAction(adminRoutes.authors(row.id)),
                openAction(routes.author(row.slug)),
                ...(canDelete
                  ? [
                      deleteAction(
                        deleteAuthor.bind(null, row.id),
                        `author ${row.name}`,
                        "Their entries stay, just without the author profile.",
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
