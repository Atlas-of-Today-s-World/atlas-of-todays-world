import type { Metadata } from "next";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/data-table/DataTable";
import { RowActions } from "@/components/data-table/RowActions";
import { optionStats } from "@/components/data-table/stats";
import { navIcon } from "@/config/admin-nav";
import { can, sectionAccess } from "@/features/auth/access";
import { deleteApplication, setApplicationStatus } from "@/features/volunteers/actions";
import { VolunteerSettingsForm } from "@/features/volunteers/components/VolunteerSettingsForm";
import { createServerClient } from "@/lib/supabase/server";

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
  const supabase = await createServerClient();
  const [settings, applications] = await Promise.all([
    supabase.from("volunteer_settings").select("notify_email").eq("id", 1).maybeSingle(),
    supabase
      .from("volunteer_applications")
      .select("id, name, email, topics, message, status, created_at")
      .order("created_at", { ascending: false })
      .limit(2000),
  ]);
  if (settings.error) throw new Error(`[volunteers] ${settings.error.message}`);
  if (applications.error) throw new Error(`[volunteers] ${applications.error.message}`);
  const canEdit = can(access.permissions, "users", "e");
  const canDelete = can(access.permissions, "users", "d");

  return (
    <>
      <PageHeader
        icon={navIcon("/admin/volunteers")}
        title="Volunteer editors"
        lead="People who applied on the Atlas Patrons page to write or review topics as volunteers."
      />
      <section className="mb-10">
        <h2 className="font-display mb-3 text-[17px] font-bold">Where applications go</h2>
        <VolunteerSettingsForm email={settings.data?.notify_email ?? null} canEdit={canEdit} />
      </section>
      <DataTable
        tableKey="admin-volunteers"
        caption="Volunteer applications"
        emptyTitle="No applications yet"
        initialSort={{ key: "received", dir: "desc" }}
        stats={optionStats("status", STATUSES)}
        actionsWidth="112px"
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
        ]}
        rows={(applications.data ?? []).map((row) => ({
          id: row.id,
          values: {
            who: row.name,
            email: row.email,
            topics: row.topics,
            message: row.message,
            status: row.status,
            received: row.created_at,
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
