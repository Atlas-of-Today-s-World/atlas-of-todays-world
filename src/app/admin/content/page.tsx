import type { Metadata } from "next";
import Link from "next/link";
import { UserRound } from "lucide-react";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/data-table/DataTable";
import { RowActions } from "@/components/data-table/RowActions";
import {
  confirmAction,
  deleteAction,
  editAction,
  openAction,
} from "@/components/data-table/row-actions";
import { optionStats } from "@/components/data-table/stats";
import { ToolbarLink } from "@/components/data-table/ToolbarLink";
import { buttonVariants } from "@/components/ui/button";
import { navIcon } from "@/config/admin-nav";
import { can, sectionAccess } from "@/features/auth/access";
import { STATUS_OPTIONS } from "@/features/entries/components/StatusBadge";
import { deleteEntry, unpublishEntry } from "@/features/entries/actions";
import { listEntries } from "@/features/entries/editorial";
import { ENTRY_STATUSES, type EntryStatus } from "@/features/entries/schema";
import { articlePath } from "@/config/navigation";

export const metadata: Metadata = { title: "Articles" };

export default async function EntriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; mine?: string }>;
}) {
  const access = await sectionAccess("news");
  if (!access) return <NoAccess />;
  const params = await searchParams;
  const status = ENTRY_STATUSES.includes(params.status as EntryStatus)
    ? (params.status as EntryStatus)
    : undefined;
  const mine = params.mine === "1";
  // Status is filtered in the table (KPI chips); the server narrows by title and owner.
  const rows = await listEntries({ q: params.q, mine, userId: access.userId });
  // Icons only for what the role may do; the DB still decides (RLS / workflow RPCs).
  const canUnpublish = can(access.permissions, "approvals", "e");
  const canDelete = can(access.permissions, "news", "d");
  const isAdmin = access.roleId === "admin";
  const mineHref = `/admin/content?${new URLSearchParams({
    ...(mine ? {} : { mine: "1" }),
    ...(params.q ? { q: params.q } : {}),
  })}`;

  return (
    <>
      <PageHeader
        icon={navIcon("/admin/content")}
        title="Articles"
        lead="Topics (encyclopedia entries) and news articles — drafts, pending approval and published. Publishing always goes through Article approvals."
        actions={
          can(access.permissions, "news", "c") ? (
            <span className="flex flex-wrap gap-2">
              <Link href="/admin/content/new?kind=entry" className={buttonVariants({ size: "sm" })}>
                New topic
              </Link>
              <Link
                href="/admin/content/new"
                className={buttonVariants({ size: "sm", variant: "outline" })}
              >
                New article
              </Link>
            </span>
          ) : null
        }
      />
      <DataTable
        tableKey="admin-entries"
        caption="Articles"
        searchParam="q"
        searchPlaceholder="Search articles…"
        seedFilters={status ? { status: [status] } : undefined}
        initialSort={{ key: "updated", dir: "desc" }}
        emptyTitle="No articles yet"
        stats={optionStats("status", STATUS_OPTIONS)}
        toolbar={
          <ToolbarLink href={mineHref} active={mine}>
            <UserRound aria-hidden className="size-3.5" /> Only my articles
          </ToolbarLink>
        }
        actionsWidth="128px"
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
            key: "status",
            label: "Status",
            kind: "badge",
            options: STATUS_OPTIONS,
            sortable: true,
            filter: "select",
            width: "150px",
          },
          { key: "category", label: "Category", sortable: true, filter: "select" },
          { key: "author", label: "Author", sortable: true, filter: "select" },
          {
            key: "updated",
            label: "Updated",
            kind: "date",
            sortable: true,
            width: "128px",
          },
        ]}
        rows={rows.map((row) => ({
          id: row.id,
          href: `/admin/content/${row.id}`,
          values: {
            title: row.title,
            status: row.status,
            category: row.category,
            author: row.author_name,
            updated: row.updated_at,
          },
          actions: (
            <RowActions
              actions={[
                editAction(`/admin/content/${row.id}`),
                ...(row.status === "published" && !row.translation_of
                  ? [openAction(articlePath(row.kind, row.slug))]
                  : []),
                ...(row.status === "published" && canUnpublish
                  ? [
                      confirmAction(
                        "archive",
                        "Unpublish",
                        unpublishEntry.bind(null, row.id),
                        `Unpublish ${row.title}?`,
                        "The article leaves the site and goes back to drafts. You can publish it again through Article approvals.",
                      ),
                    ]
                  : []),
                ...(canDelete && (row.status !== "published" || isAdmin)
                  ? [
                      deleteAction(
                        deleteEntry.bind(null, row.id),
                        `article ${row.title}`,
                        "The article, its topics, sources and history are deleted. This cannot be undone.",
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
