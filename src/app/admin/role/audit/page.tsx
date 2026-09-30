import type { Metadata } from "next";
import { DataTable } from "@/components/admin/DataTable";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { sectionAccess } from "@/features/auth/access";
import { auditLog } from "@/features/roles/editorial";

export const metadata: Metadata = { title: "Záznam změn" };

const dateFormat = new Intl.DateTimeFormat("cs-CZ", { dateStyle: "short", timeStyle: "medium" });

/** Záznam změn (audit_log): kdo, kdy, co — bez osobních údajů v detailu (DB-14). */
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ akce?: string; cil?: string }>;
}) {
  if (!(await sectionAccess("permissions"))) return <NoAccess />;
  const { akce, cil } = await searchParams;
  const rows = await auditLog({ action: akce, target: cil });

  return (
    <>
      <PageHeader
        title="Záznam změn"
        lead="Posledních 300 změn oprávnění, rolí, účtů a stavů článků. Uchovává se 12 měsíců."
      />
      <form action="/admin/role/audit" className="mb-4 flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="akce" className="text-[12px] text-[var(--color-ink-muted)]">
            Akce
          </label>
          <Input id="akce" name="akce" defaultValue={akce} placeholder="např. entries" />
        </div>
        <div>
          <label htmlFor="cil" className="text-[12px] text-[var(--color-ink-muted)]">
            Cíl
          </label>
          <Input id="cil" name="cil" defaultValue={cil} placeholder="slug, id…" />
        </div>
        <Button type="submit" variant="outline" size="sm">
          Filtrovat
        </Button>
      </form>
      <DataTable
        caption="Záznam změn"
        rows={rows}
        rowKey={(row) => String(row.id)}
        empty="Žádné záznamy."
        columns={[
          { key: "at", header: "Kdy", cell: (row) => dateFormat.format(new Date(row.at)) },
          { key: "who", header: "Kdo", cell: (row) => row.actor_email ?? "systém" },
          { key: "action", header: "Akce", cell: (row) => <code>{row.action}</code> },
          { key: "target", header: "Cíl", cell: (row) => row.target ?? "—", wide: true },
          {
            key: "detail",
            header: "Změna",
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
