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

export const metadata: Metadata = { title: "Accounts" };

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });
const STATUS: Record<AccountRow["status"], string> = {
  active: "active",
  pending: "pending",
  blocked: "blocked",
};

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; q?: string }>;
}) {
  if (!(await sectionAccess("users"))) return <NoAccess />;
  const params = await searchParams;
  const kind = params.kind === "readers" ? "reader" : "staff";
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
        title="Accounts"
        lead="The Atlas team and registered readers. The team is invitation-only."
        actions={
          <Link href="/admin/accounts/invitations" className={buttonVariants()}>
            Invitations
          </Link>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {tab("/admin/accounts", "Team", kind === "staff")}
        {tab("/admin/accounts?kind=readers", "Readers", kind === "reader")}
        <form action="/admin/accounts" className="ml-auto">
          {kind === "reader" ? <input type="hidden" name="kind" value="readers" /> : null}
          <label htmlFor="q" className="sr-only">
            Search accounts
          </label>
          <Input
            id="q"
            name="q"
            type="search"
            placeholder="Email or name…"
            defaultValue={params.q}
          />
        </form>
      </div>
      <DataTable
        caption="Accounts"
        rows={accounts}
        rowKey={(row) => row.id}
        empty="No accounts."
        columns={[
          {
            key: "email",
            header: "Email",
            cell: (row) => (
              <Link href={`/admin/accounts/${row.id}`} className="font-medium hover:underline">
                {row.email}
              </Link>
            ),
          },
          { key: "name", header: "Name", cell: (row) => row.name || "—", wide: true },
          { key: "role", header: "Role", cell: (row) => roleName.get(row.role_id) ?? row.role_id },
          {
            key: "status",
            header: "Status",
            cell: (row) => (
              <span className={row.status === "blocked" ? "text-red-700" : undefined}>
                {STATUS[row.status]}
              </span>
            ),
          },
          {
            key: "created",
            header: "Since",
            end: true,
            wide: true,
            cell: (row) => dateFormat.format(new Date(row.created_at)),
          },
        ]}
      />
    </>
  );
}
