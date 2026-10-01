import type { Metadata } from "next";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/data-table/DataTable";
import { RowActions } from "@/components/data-table/RowActions";
import { optionStats } from "@/components/data-table/stats";
import { navIcon } from "@/config/admin-nav";
import { sectionAccess } from "@/features/auth/access";
import { approvalQueue } from "@/features/entries/editorial";

export const metadata: Metadata = { title: "Article approvals" };

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
  if (!(await sectionAccess("approvals"))) return <NoAccess />;
  const queue = await approvalQueue();

  return (
    <>
      <PageHeader
        icon={navIcon("/admin/approvals")}
        title="Article approvals"
        lead="Articles waiting for a second pair of eyes. Open an article, compare it with the published version, then approve it or return it with a note."
      />
      <DataTable
        tableKey="admin-approvals"
        caption="Articles waiting for approval"
        emptyTitle="No articles are waiting for approval"
        initialSort={{ key: "submitted", dir: "asc" }}
        stats={optionStats("who", WHO, "All awaiting approval")}
        actionsWidth="48px"
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
          href: `/admin/content/${row.id}`,
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
                  label: "Review article",
                  href: `/admin/content/${row.id}`,
                },
              ]}
            />
          ),
        }))}
      />
    </>
  );
}
