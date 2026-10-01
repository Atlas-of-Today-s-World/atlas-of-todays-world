import type { Metadata } from "next";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/data-table/DataTable";
import { navIcon } from "@/config/admin-nav";
import { sectionAccess } from "@/features/auth/access";
import { auditLog } from "@/features/roles/editorial";

export const metadata: Metadata = { title: "Audit log" };

/** Záznam změn (audit_log): kdo, kdy, co — bez osobních údajů v detailu (DB-14). */
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  if (!(await sectionAccess("permissions"))) return <NoAccess />;
  const { q } = await searchParams;
  const rows = await auditLog(q);

  return (
    <>
      <PageHeader
        icon={navIcon("/admin/roles")}
        title="Audit log"
        lead="The last 1,000 changes to permissions, roles, accounts and article statuses. Kept for 12 months."
      />
      <DataTable
        tableKey="admin-audit"
        caption="Audit log"
        searchParam="q"
        searchPlaceholder="Action, target or email…"
        emptyTitle="No records"
        initialSort={{ key: "at", dir: "desc" }}
        columns={[
          { key: "at", label: "When", kind: "datetime", sortable: true, width: "168px" },
          { key: "who", label: "Who", sortable: true, filter: "select" },
          { key: "action", label: "Action", kind: "code", sortable: true, filter: "select" },
          { key: "target", label: "Target", sortable: true, filter: "text" },
          {
            key: "detail",
            label: "Change",
            kind: "code",
            filter: "text",
            width: "minmax(240px, 3fr)",
          },
        ]}
        rows={rows.map((row) => ({
          id: String(row.id),
          values: {
            at: row.at,
            who: row.actor_email ?? "system",
            action: row.action,
            target: row.target,
            detail: JSON.stringify(row.detail),
          },
        }))}
      />
    </>
  );
}
