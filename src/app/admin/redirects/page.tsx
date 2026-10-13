import type { Metadata } from "next";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/data-table/DataTable";
import { RowActions } from "@/components/data-table/RowActions";
import { deleteAction, editAction, type RowAction } from "@/components/data-table/row-actions";
import { optionStats } from "@/components/data-table/stats";
import { navIcon } from "@/config/admin-nav";
import { BUILT_IN_REDIRECTS } from "@/config/redirects";
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
 * Redirect management (G3). A redirect only applies instead of a 404 page —
 * it never overrides an existing page. Guarded by RLS: news "c" adds, news "e"
 * or site "e" edits, news "d" deletes. The redirects built into the site
 * (next.config, src/config/redirects.ts) are listed read-only below.
 */
export default async function RedirectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const access = await sectionAccess(["news", "site"]);
  if (!access) return <NoAccess />;
  const { q } = await searchParams;
  const rows = await listRedirects(q);
  const canEdit = can(access.permissions, "news", "e") || can(access.permissions, "site", "e");
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
          actionsWidth="80px"
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
          rows={rows.map((row) => {
            const actions: RowAction[] = [
              ...(canEdit ? [editAction(`/admin/redirects/${row.id}`)] : []),
              ...(canDelete
                ? [
                    deleteAction(
                      deleteRedirect.bind(null, row.id),
                      "the redirect",
                      `The URL ${row.from_path} will then lead to the “not found” page.`,
                    ),
                  ]
                : []),
            ];
            return {
              id: row.id,
              values: {
                from: row.from_path,
                to: row.to_path,
                kind: row.permanent ? "permanent" : "temporary",
                created: row.created_at,
              },
              actions: actions.length ? <RowActions actions={actions} /> : undefined,
            };
          })}
        />
      </div>

      <details className="mt-10" data-testid="built-in-redirects">
        <summary className="font-display flex min-h-(--touch-min) cursor-pointer items-center text-[17px] font-bold">
          Built-in redirects ({BUILT_IN_REDIRECTS.length})
        </summary>
        <p className="mt-1 mb-4 max-w-3xl text-[13px] text-[var(--color-ink-soft)]">
          Old address shapes built into the website. They always apply — even over an existing page
          — and change only with a new release, so they can&apos;t be edited here.
        </p>
        <DataTable
          compact
          tableKey="admin-redirects-built-in"
          caption="Built-in redirects"
          emptyTitle="No built-in redirects"
          columns={[
            { key: "from", label: "Old path", kind: "code", width: "minmax(200px, 2fr)" },
            { key: "to", label: "New path", kind: "code", width: "minmax(200px, 2fr)" },
            { key: "reason", label: "Why", width: "minmax(220px, 3fr)" },
          ]}
          rows={BUILT_IN_REDIRECTS.map((rule) => ({
            id: rule.source,
            values: { from: rule.source, to: rule.destination, reason: rule.reason },
          }))}
        />
      </details>
    </>
  );
}
