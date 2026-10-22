import type { Metadata } from "next";
import Link from "next/link";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/data-table/DataTable";
import { RowActions } from "@/components/data-table/RowActions";
import { deleteAction, editAction, openAction } from "@/components/data-table/row-actions";
import { optionStats } from "@/components/data-table/stats";
import { buttonVariants } from "@/components/ui/button";
import { navIcon } from "@/config/admin-nav";
import { adminRoutes, routes } from "@/config/routes";
import { can, getAccess } from "@/features/auth/access";
import { deletePosition } from "@/features/careers/actions";
import { listPositions, positionRight } from "@/features/careers/editorial";

export const metadata: Metadata = { title: "Careers" };

const STATUSES = [
  { value: "open", label: "Open", tone: "success" as const },
  { value: "draft", label: "Draft", tone: "accent" as const },
  { value: "closed", label: "Closed", tone: "neutral" as const },
];

/**
 * Careers (section `site` or `users`): the positions on /careers. Applications
 * are personal data, so their page is open to the `users` section only.
 */
export default async function CareersPage() {
  const access = await getAccess();
  if (!access || !positionRight(access.permissions, "v")) return <NoAccess />;
  const positions = await listPositions();
  const canEdit = positionRight(access.permissions, "e");
  const canDelete = positionRight(access.permissions, "d");
  const seesApplications = can(access.permissions, "users", "v");

  return (
    <>
      <PageHeader
        icon={navIcon(adminRoutes.careers.list)}
        title="Careers"
        lead={
          <>
            Positions in the team, listed on the{" "}
            <a href={routes.careers} className="text-[var(--color-link)] underline">
              careers page
            </a>{" "}
            while they are open. People apply with their CV and a message under each position.
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {positionRight(access.permissions, "c") ? (
          <Link href={adminRoutes.careers.new} className={buttonVariants({ size: "sm" })}>
            Add position
          </Link>
        ) : null}
        {seesApplications ? (
          <Link
            href={adminRoutes.careerApplications}
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            Applications
          </Link>
        ) : null}
      </div>
      <DataTable
        tableKey="admin-careers"
        caption="Positions on the careers page"
        searchPlaceholder="Search positions…"
        emptyTitle="No positions yet — the careers page says there are none open"
        initialSort={{ key: "updated", dir: "desc" }}
        stats={optionStats("status", STATUSES)}
        maxRowActions={(canEdit ? 1 : 0) + 1 + (canDelete ? 1 : 0)}
        columns={[
          {
            key: "title",
            label: "Job title",
            link: true,
            sortable: true,
            filter: "text",
            width: "minmax(200px, 2fr)",
          },
          { key: "location", label: "Location", filter: "text", width: "minmax(120px, 1fr)" },
          { key: "type", label: "Job type", filter: "text", width: "minmax(120px, 1fr)" },
          {
            key: "status",
            label: "Status",
            kind: "badge",
            options: STATUSES,
            sortable: true,
            filter: "select",
            width: "112px",
          },
          ...(seesApplications
            ? [
                {
                  key: "applications",
                  label: "Applications",
                  kind: "number" as const,
                  align: "right" as const,
                  sortable: true,
                  width: "120px",
                },
              ]
            : []),
          { key: "opened", label: "Opened", kind: "date", sortable: true, width: "120px" },
          { key: "updated", label: "Updated", kind: "date", sortable: true, width: "120px" },
        ]}
        rows={positions.map((row) => ({
          id: row.id,
          href: canEdit ? adminRoutes.careers(row.id) : undefined,
          values: {
            title: row.title,
            location: row.location,
            type: row.job_type,
            status: row.status,
            applications: row.applications,
            opened: row.opened_at,
            updated: row.updated_at,
          },
          actions: (
            <RowActions
              actions={[
                ...(canEdit ? [editAction(adminRoutes.careers(row.id))] : []),
                ...(row.status === "open" ? [openAction(routes.career(row.slug))] : []),
                ...(canDelete
                  ? [
                      deleteAction(
                        deletePosition.bind(null, row.id),
                        `the position “${row.title}”`,
                        "It disappears from the careers page; its applications stay. This cannot be undone.",
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
