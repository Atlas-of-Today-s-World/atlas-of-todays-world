import type { Metadata } from "next";
import Link from "next/link";
import { DataTable } from "@/components/admin/DataTable";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { sectionAccess } from "@/features/auth/access";
import { listAccounts, listRoles, type AccountRow } from "@/features/accounts/editorial";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Účty" };

const dateFormat = new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium" });
const STATUS: Record<AccountRow["status"], string> = {
  active: "aktivní",
  pending: "čeká",
  blocked: "zablokovaný",
};

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ druh?: string; q?: string }>;
}) {
  if (!(await sectionAccess("users"))) return <NoAccess />;
  const params = await searchParams;
  const kind = params.druh === "ctenari" ? "reader" : "staff";
  const [accounts, roles] = await Promise.all([listAccounts(kind, params.q), listRoles()]);
  const roleName = new Map(roles.map((role) => [role.id, role.name]));

  const tab = (href: string, label: string, active: boolean) => (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        buttonVariants({ variant: "outline", size: "sm" }),
        active && "border-[var(--color-accent)] text-[var(--color-accent)]",
      )}
    >
      {label}
    </Link>
  );

  return (
    <>
      <PageHeader
        title="Účty"
        lead="Tým Atlasu a registrovaní čtenáři. Do týmu se vstupuje pozvánkou."
        actions={
          <Link href="/admin/ucty/pozvanky" className={buttonVariants()}>
            Pozvánky
          </Link>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {tab("/admin/ucty", "Tým", kind === "staff")}
        {tab("/admin/ucty?druh=ctenari", "Čtenáři", kind === "reader")}
        <form action="/admin/ucty" className="ml-auto">
          {kind === "reader" ? <input type="hidden" name="druh" value="ctenari" /> : null}
          <label htmlFor="q" className="sr-only">
            Hledat účet
          </label>
          <Input
            id="q"
            name="q"
            type="search"
            placeholder="E-mail nebo jméno…"
            defaultValue={params.q}
          />
        </form>
      </div>
      <DataTable
        caption="Účty"
        rows={accounts}
        rowKey={(row) => row.id}
        empty="Žádný účet."
        columns={[
          {
            key: "email",
            header: "E-mail",
            cell: (row) => (
              <Link href={`/admin/ucty/${row.id}`} className="font-medium hover:underline">
                {row.email}
              </Link>
            ),
          },
          { key: "name", header: "Jméno", cell: (row) => row.name || "—", wide: true },
          { key: "role", header: "Role", cell: (row) => roleName.get(row.role_id) ?? row.role_id },
          {
            key: "status",
            header: "Stav",
            cell: (row) => (
              <span className={row.status === "blocked" ? "text-red-700" : undefined}>
                {STATUS[row.status]}
              </span>
            ),
          },
          {
            key: "created",
            header: "Od",
            end: true,
            wide: true,
            cell: (row) => dateFormat.format(new Date(row.created_at)),
          },
        ]}
      />
    </>
  );
}
