import { DataTable } from "@/components/data-table/DataTable";
import { RowActions } from "@/components/data-table/RowActions";
import { confirmAction } from "@/components/data-table/row-actions";
import { restoreSitePageRevision } from "../actions";
import type { PageRevision } from "../editorial";

/**
 * Saved versions of a site page (newest first — the first is what is saved
 * now) with restore. Restoring brings back the text, not the published switch.
 */
export function PageRevisions({
  slug,
  revisions,
  canRestore,
}: {
  slug: string;
  revisions: PageRevision[];
  canRestore: boolean;
}) {
  return (
    <DataTable
      compact
      tableKey="admin-site-page-revisions"
      caption="Saved versions"
      emptyTitle="No saved versions yet"
      actionsWidth="48px"
      columns={[
        { key: "saved", label: "Saved", kind: "datetime", width: "150px" },
        { key: "by", label: "By", width: "minmax(100px, 1fr)" },
        { key: "title", label: "Title", hidden: true, width: "minmax(140px, 1fr)" },
      ]}
      rows={revisions.map((revision, index) => ({
        id: String(revision.id),
        values: {
          saved: revision.saved_at,
          // No editor: the text the page started with (migration), or a removed account.
          by: revision.saved_by ?? "—",
          title: revision.title,
        },
        actions:
          canRestore && index > 0 ? (
            <RowActions
              actions={[
                confirmAction(
                  "restore",
                  "Restore",
                  restoreSitePageRevision.bind(null, slug, revision.id),
                  "Restore this version?",
                  "The title, description, date, introduction and text go back to this version. The current version stays in the history.",
                ),
              ]}
            />
          ) : undefined,
      }))}
    />
  );
}
