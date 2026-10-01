import type { Metadata } from "next";
import { DataTable } from "@/components/admin/DataTable";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { sectionAccess } from "@/features/auth/access";
import { auditLog } from "@/features/roles/editorial";

export const metadata: Metadata = { title: "Audit log" };

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "short", timeStyle: "medium" });

/** Záznam změn (audit_log): kdo, kdy, co — bez osobních údajů v detailu (DB-14). */
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; target?: string }>;
}) {
  if (!(await sectionAccess("permissions"))) return <NoAccess />;
  const { action, target } = await searchParams;
  const rows = await auditLog({ action, target });

  return (
    <>
      <PageHeader
        title="Audit log"
        lead="The last 300 changes to permissions, roles, accounts and article statuses. Kept for 12 months."
      />
      <form action="/admin/roles/audit" className="mb-4 flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="action" className="text-[12px] text-[var(--color-ink-muted)]">
            Action
          </label>
          <Input id="action" name="action" defaultValue={action} placeholder="e.g. entries" />
        </div>
        <div>
          <label htmlFor="target" className="text-[12px] text-[var(--color-ink-muted)]">
            Target
          </label>
          <Input id="target" name="target" defaultValue={target} placeholder="slug, id…" />
        </div>
        <Button type="submit" variant="outline" size="sm">
          Filter
        </Button>
      </form>
      <DataTable
        caption="Audit log"
        rows={rows}
        rowKey={(row) => String(row.id)}
        empty="No records."
        columns={[
          { key: "at", header: "When", cell: (row) => dateFormat.format(new Date(row.at)) },
          { key: "who", header: "Who", cell: (row) => row.actor_email ?? "system" },
          { key: "action", header: "Action", cell: (row) => <code>{row.action}</code> },
          { key: "target", header: "Target", cell: (row) => row.target ?? "—", wide: true },
          {
            key: "detail",
            header: "Change",
            wide: true,
            cell: (row) => (
              <code className="line-clamp-2 max-w-md text-[11.5px] break-all">
                {JSON.stringify(row.detail)}
              </code>
            ),
          },
        ]}
      />
    </>
  );
}
