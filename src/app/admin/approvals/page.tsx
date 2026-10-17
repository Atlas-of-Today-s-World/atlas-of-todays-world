import type { Metadata } from "next";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/data-table/DataTable";
import { RowActions } from "@/components/data-table/RowActions";
import { confirmAction, noteAction } from "@/components/data-table/row-actions";
import { optionStats } from "@/components/data-table/stats";
import { navIcon } from "@/config/admin-nav";
import { adminRoutes } from "@/config/routes";
import { can, sectionAccess } from "@/features/auth/access";
import { approveEntry, sendBackEntry } from "@/features/entries/workflow-actions";
import { approvalQueue } from "@/features/entries/editorial";

export const metadata: Metadata = { title: "Approvals" };

const WHO = [
  { value: "you", label: "You can approve", tone: "success" as const },
  { value: "others", label: "Another approver", tone: "neutral" as const },
];

/**
 * Approval queue (ARCHITEKTURA 5.2, E3): pending articles, oldest first.
 * Who may approve what is computed by the DB (`can_approve_entry`) — globally, by
 * assigned countries or authors; nobody but an admin approves their own article.
 */
export default async function ApprovalsPage() {
  const access = await sectionAccess("approvals");
  if (!access) return <NoAccess />;
  const canApprove = can(access.permissions, "approvals", "e");
  const queue = await approvalQueue();

  return (
    <>
      <PageHeader
        icon={navIcon(adminRoutes.approvals)}
        title="Approvals"
        lead="Entries waiting for a second pair of eyes. Open one, compare it with the published version, then approve it or return it with a note."
      />
      <DataTable
        tableKey="admin-approvals"
        caption="Waiting for approval"
        emptyTitle="Nothing is waiting for approval"
        initialSort={{ key: "submitted", dir: "asc" }}
        stats={optionStats("who", WHO, "All awaiting approval")}
        maxRowActions={canApprove ? 3 : 1}
        columns={[
          {
            key: "title",
            label: "Title",
            link: true,
            sortable: true,
            filter: "text",
            width: "minmax(240px, 3fr)",
          },
          {
            key: "who",
            label: "Who approves",
            kind: "badge",
            options: WHO,
            filter: "select",
            sortable: true,
            width: "160px",
          },
          { key: "category", label: "Category", sortable: true, filter: "select" },
          { key: "author", label: "Author", sortable: true, filter: "select" },
          { key: "scheduled", label: "Scheduled", kind: "datetime", sortable: true },
          { key: "submitted", label: "Submitted", kind: "datetime", sortable: true },
        ]}
        rows={queue.map((row) => ({
          id: row.id,
          href: adminRoutes.content(row.id),
          values: {
            title: row.title,
            who: row.canApprove ? "you" : "others",
            category: row.category,
            author: row.author_name,
            scheduled: row.publish_at,
            submitted: row.updated_at,
          },
          actions: (
            <RowActions
              actions={[
                {
                  kind: "link",
                  icon: "view",
                  label: "Review",
                  href: adminRoutes.content(row.id),
                },
                ...(canApprove
                  ? [
                      confirmAction(
                        "approve",
                        "Approve and publish",
                        // The version listed here: refused if the article changed since.
                        approveEntry.bind(null, row.id, row.updated_at),
                        `Publish ${row.title}?`,
                        "It goes live on the site (or at its scheduled time). To ask for changes, send it back with a note instead.",
                      ),
                      noteAction(
                        "return",
                        "Send back",
                        sendBackEntry,
                        { id: row.id },
                        {
                          title: `Send ${row.title} back to its author?`,
                          body: "It returns to a draft; the author sees your note on it.",
                          noteLabel: "What should change",
                          noteMax: 2000,
                          confirmLabel: "Request changes",
                        },
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
