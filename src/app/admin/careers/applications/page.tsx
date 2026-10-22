import type { Metadata } from "next";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/data-table/DataTable";
import { RowActions } from "@/components/data-table/RowActions";
import { optionStats } from "@/components/data-table/stats";
import { navIcon } from "@/config/admin-nav";
import { adminRoutes } from "@/config/routes";
import { can, sectionAccess } from "@/features/auth/access";
import { deleteApplication, setApplicationStatus } from "@/features/careers/actions";
import { listApplications } from "@/features/careers/editorial";

export const metadata: Metadata = { title: "Job applications" };

const STATUSES = [
  { value: "new", label: "New", tone: "accent" as const },
  { value: "contacted", label: "Contacted", tone: "success" as const },
  { value: "closed", label: "Closed", tone: "neutral" as const },
];

const sizeLabel = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} kB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/**
 * Applications to the positions on /careers (section `users`: personal data).
 * A CV opens through a short-lived signed link (route `careerCv`).
 */
export default async function CareerApplicationsPage() {
  const access = await sectionAccess("users");
  if (!access) return <NoAccess />;
  const applications = await listApplications();
  const canEdit = can(access.permissions, "users", "e");
  const canDelete = can(access.permissions, "users", "d");
  const positions = [...new Set(applications.map((row) => row.position_title))].sort();

  return (
    <>
      <PageHeader
        icon={navIcon(adminRoutes.careers.list)}
        title="Job applications"
        lead="People who applied for a position on the careers page, with their CV and message."
      />
      <DataTable
        tableKey="admin-career-applications"
        caption="Job applications"
        emptyTitle="No applications yet"
        initialSort={{ key: "received", dir: "desc" }}
        stats={optionStats("status", STATUSES)}
        // The CV, the two statuses a row is not in, then delete.
        maxRowActions={1 + (canEdit ? 2 : 0) + (canDelete ? 1 : 0)}
        columns={[
          {
            key: "who",
            label: "Name",
            sortable: true,
            filter: "text",
            width: "minmax(160px, 1fr)",
          },
          {
            key: "email",
            label: "E-mail",
            sortable: true,
            filter: "text",
            width: "minmax(200px, 1fr)",
          },
          {
            key: "position",
            label: "Position",
            sortable: true,
            filter: "select",
            options: positions.map((title) => ({ value: title, label: title })),
            width: "minmax(140px, 1fr)",
          },
          { key: "message", label: "Message", filter: "text", width: "minmax(280px, 3fr)" },
          { key: "cv", label: "CV", filter: "text", width: "minmax(160px, 1fr)" },
          {
            key: "status",
            label: "Status",
            kind: "badge",
            options: STATUSES,
            sortable: true,
            filter: "select",
            width: "120px",
          },
          { key: "received", label: "Received", kind: "datetime", sortable: true, width: "160px" },
        ]}
        rows={applications.map((row) => ({
          id: row.id,
          values: {
            who: row.name,
            email: row.email,
            position: row.position_title,
            message: row.message,
            cv: `${row.cv_name} (${sizeLabel(row.cv_size)})`,
            status: row.status,
            received: row.created_at,
          },
          cells: {
            email: (
              <a href={`mailto:${row.email}`} className="text-[var(--color-link)] underline">
                {row.email}
              </a>
            ),
            message: <span className="whitespace-pre-line">{row.message}</span>,
            cv: (
              <a
                href={adminRoutes.careerCv(row.id)}
                className="text-[var(--color-link)] underline"
                rel="noopener"
              >
                {row.cv_name}
              </a>
            ),
          },
          actions: (
            <RowActions
              actions={[
                {
                  kind: "link" as const,
                  icon: "download" as const,
                  label: "Download CV",
                  href: adminRoutes.careerCv(row.id),
                  download: true,
                },
                ...(canEdit && row.status !== "contacted"
                  ? [
                      {
                        kind: "action" as const,
                        icon: "approve" as const,
                        label: "Mark as contacted",
                        action: setApplicationStatus.bind(null, row.id, "contacted"),
                        confirmTitle: `Mark ${row.name} as contacted?`,
                        confirmBody: "Use it once you have written to them.",
                        confirmLabel: "Mark contacted",
                      },
                    ]
                  : []),
                ...(canEdit && row.status !== "new"
                  ? [
                      {
                        kind: "action" as const,
                        icon: "restore" as const,
                        label: "Mark as new",
                        action: setApplicationStatus.bind(null, row.id, "new"),
                        confirmTitle: `Mark the application of ${row.name} as new again?`,
                        confirmBody: "It goes back among the applications nobody has answered yet.",
                        confirmLabel: "Mark as new",
                      },
                    ]
                  : []),
                ...(canEdit && row.status !== "closed"
                  ? [
                      {
                        kind: "action" as const,
                        icon: "archive" as const,
                        label: "Close",
                        action: setApplicationStatus.bind(null, row.id, "closed"),
                        confirmTitle: `Close the application of ${row.name}?`,
                        confirmBody: "It stays in the list as closed.",
                        confirmLabel: "Close",
                      },
                    ]
                  : []),
                ...(canDelete
                  ? [
                      {
                        kind: "action" as const,
                        icon: "delete" as const,
                        label: "Delete application",
                        danger: true,
                        action: deleteApplication.bind(null, row.id),
                        confirmTitle: `Delete the application of ${row.name}?`,
                        confirmBody: "Their details and CV are removed for good.",
                        confirmLabel: "Delete",
                      },
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
