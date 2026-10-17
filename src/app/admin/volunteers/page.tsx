import type { Metadata } from "next";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/data-table/DataTable";
import { RowActions } from "@/components/data-table/RowActions";
import { optionStats } from "@/components/data-table/stats";
import { navIcon } from "@/config/admin-nav";
import { adminRoutes } from "@/config/routes";
import { can, sectionAccess } from "@/features/auth/access";
import { deleteApplication, setApplicationStatus } from "@/features/volunteers/actions";
import { VolunteerSettingsForm } from "@/features/volunteers/components/VolunteerSettingsForm";
import { volunteersOverview } from "@/features/volunteers/editorial";

export const metadata: Metadata = { title: "Volunteer editors" };

const STATUSES = [
  { value: "new", label: "New", tone: "accent" as const },
  { value: "contacted", label: "Contacted", tone: "success" as const },
  { value: "closed", label: "Closed", tone: "neutral" as const },
];

/**
 * Volunteer editors (accounts section): where applications from /membership
 * are sent, and the applications themselves. E-mail sending comes later; until
 * then this list is where they arrive.
 */
export default async function VolunteersPage() {
  const access = await sectionAccess("users");
  if (!access) return <NoAccess />;
  const { notifyEmail, applications } = await volunteersOverview();
  const canEdit = can(access.permissions, "users", "e");
  const canDelete = can(access.permissions, "users", "d");

  return (
    <>
      <PageHeader
        icon={navIcon(adminRoutes.volunteers)}
        title="Volunteer editors"
        lead="People who applied on the Atlas Patrons page to write or review entries as volunteers."
      />
      <section className="mb-10">
        <h2 className="font-display mb-3 text-[17px] font-bold">Where applications go</h2>
        <VolunteerSettingsForm email={notifyEmail} canEdit={canEdit} />
      </section>
      <DataTable
        tableKey="admin-volunteers"
        caption="Volunteer applications"
        emptyTitle="No applications yet"
        initialSort={{ key: "received", dir: "desc" }}
        stats={optionStats("status", STATUSES)}
        // A row offers the two statuses it is not in (of new / contacted / closed), then delete.
        maxRowActions={(canEdit ? 2 : 0) + (canDelete ? 1 : 0)}
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
            key: "topics",
            label: "Would write about",
            filter: "text",
            width: "minmax(200px, 1.5fr)",
          },
          { key: "message", label: "Message", filter: "text", width: "minmax(240px, 2fr)" },
          {
            key: "status",
            label: "Status",
            kind: "badge",
            options: STATUSES,
            sortable: true,
            filter: "select",
            width: "120px",
          },
          { key: "received", label: "Received", kind: "date", sortable: true, width: "128px" },
          {
            key: "notified",
            label: "E-mailed to the team",
            kind: "datetime",
            sortable: true,
            width: "160px",
          },
        ]}
        rows={applications.map((row) => ({
          id: row.id,
          values: {
            who: row.name,
            email: row.email,
            topics: row.topics,
            message: row.message,
            status: row.status,
            received: row.created_at,
            notified: row.notified_at,
          },
          actions:
            canEdit || canDelete ? (
              <RowActions
                actions={[
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
                          confirmBody:
                            "It goes back among the applications nobody has answered yet.",
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
                          confirmBody: "Their details are removed for good.",
                          confirmLabel: "Delete",
                        },
                      ]
                    : []),
                ]}
              />
            ) : undefined,
        }))}
      />
    </>
  );
}
