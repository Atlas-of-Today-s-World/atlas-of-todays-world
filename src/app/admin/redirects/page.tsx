import type { Metadata } from "next";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/data-table/DataTable";
import { RowActions } from "@/components/data-table/RowActions";
import { deleteAction } from "@/components/data-table/row-actions";
import { optionStats } from "@/components/data-table/stats";
import { navIcon } from "@/config/admin-nav";
import { can, sectionAccess } from "@/features/auth/access";
import { deleteRedirect } from "@/features/redirects/actions";
import { RedirectForm } from "@/features/redirects/components/RedirectForms";
import { listRedirects } from "@/features/redirects/editorial";

export const metadata: Metadata = { title: "URL redirects" };

const KIND = [
  { value: "permanent", label: "Permanent", tone: "accent" as const },
  { value: "temporary", label: "Temporary", tone: "neutral" as const },
];

/**
 * Správa přesměrování (G3). Přesměrování se uplatní jen místo stránky 404 —
 * existující stránku nepřebije. Kdo smí přidat a smazat, hlídá RLS (sekce news).
 */
export default async function RedirectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const access = await sectionAccess("news");
  if (!access) return <NoAccess />;
  const { q } = await searchParams;
  const rows = await listRedirects(q);
  const canDelete = can(access.permissions, "news", "d");

  return (
    <>
      <PageHeader
        icon={navIcon("/admin/redirects")}
        title="URL redirects"
        lead="When an article's or page's address changes, add a redirect from the old path to the new one. It applies only where the page would otherwise be “not found” — it never overrides an existing page."
      />

      {can(access.permissions, "news", "c") ? <RedirectForm /> : null}

      <div className="mt-10">
        <DataTable
          tableKey="admin-redirects"
          caption="Redirects"
          searchParam="q"
          searchPlaceholder="Search paths…"
          emptyTitle="No URL redirects yet"
          initialSort={{ key: "created", dir: "desc" }}
          stats={optionStats("kind", KIND)}
          actionsWidth="48px"
          columns={[
            { key: "from", label: "Old path", kind: "code", sortable: true, filter: "text" },
            { key: "to", label: "New path", kind: "code", sortable: true, filter: "text" },
            {
              key: "kind",
              label: "Type",
              kind: "badge",
              options: KIND,
              sortable: true,
              filter: "select",
              width: "150px",
            },
            { key: "created", label: "Added", kind: "date", sortable: true, width: "128px" },
          ]}
          rows={rows.map((row) => ({
            id: row.id,
            values: {
              from: row.from_path,
              to: row.to_path,
              kind: row.permanent ? "permanent" : "temporary",
              created: row.created_at,
            },
            actions: canDelete ? (
              <RowActions
                actions={[
                  deleteAction(
                    deleteRedirect.bind(null, row.id),
                    "the redirect",
                    `The URL ${row.from_path} will then lead to the “not found” page.`,
                  ),
                ]}
              />
            ) : undefined,
          }))}
        />
      </div>
    </>
  );
}
