import type { Metadata } from "next";
import Link from "next/link";
import { forbidden } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/data-table/DataTable";
import { RowActions } from "@/components/data-table/RowActions";
import { editAction } from "@/components/data-table/row-actions";
import { optionStats } from "@/components/data-table/stats";
import { ToolbarLink } from "@/components/data-table/ToolbarLink";
import { buttonVariants } from "@/components/ui/button";
import { navIcon } from "@/config/admin-nav";
import { adminRoutes } from "@/config/routes";
import { sectionAccess } from "@/features/auth/access";
import { listAccounts } from "@/features/accounts/editorial";
import { listRoles } from "@/features/roles/editorial";

export const metadata: Metadata = { title: "Team & reader accounts" };

const STATUS = [
  { value: "active", label: "Active", tone: "success" as const },
  { value: "pending", label: "Pending", tone: "warning" as const },
  { value: "blocked", label: "Blocked", tone: "danger" as const },
];

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; q?: string }>;
}) {
  if (!(await sectionAccess("users"))) forbidden();
  const params = await searchParams;
  const kind = params.kind === "readers" ? "reader" : "staff";
  const [accounts, roles] = await Promise.all([listAccounts(kind, params.q), listRoles()]);

  return (
    <>
      <PageHeader
        icon={navIcon(adminRoutes.accounts.list)}
        title="Team & reader accounts"
        lead="The Atlas team and registered readers. The team is invitation-only."
        actions={
          <Link href={adminRoutes.invitations} className={buttonVariants({ size: "sm" })}>
            Team invitations
          </Link>
        }
      />
      <DataTable
        key={kind}
        tableKey={`admin-accounts-${kind}`}
        caption={kind === "staff" ? "Team accounts" : "Reader accounts"}
        searchParam="q"
        searchPlaceholder="Email or name…"
        emptyTitle="No accounts found"
        initialSort={{ key: "email", dir: "asc" }}
        stats={optionStats("status", STATUS)}
        toolbar={
          <>
            <ToolbarLink kind="tab" href={adminRoutes.accounts.list} active={kind === "staff"}>
              Team members
            </ToolbarLink>
            <ToolbarLink kind="tab" href={adminRoutes.readers} active={kind === "reader"}>
              Readers
            </ToolbarLink>
          </>
        }
        actionsWidth="48px"
        columns={[
          {
            key: "email",
            label: "Email",
            link: true,
            sortable: true,
            filter: "text",
            width: "minmax(220px, 2fr)",
          },
          { key: "name", label: "Name", sortable: true, filter: "text" },
          {
            key: "role",
            label: "Role",
            kind: "badge",
            options: roles.map((role) => ({
              value: role.id,
              label: role.name,
              tone: "accent" as const,
            })),
            sortable: true,
            filter: "select",
          },
          {
            key: "status",
            label: "Status",
            kind: "badge",
            options: STATUS,
            sortable: true,
            filter: "select",
            width: "120px",
          },
          { key: "seen", label: "Last seen", kind: "date", sortable: true, width: "128px" },
          { key: "created", label: "Since", kind: "date", sortable: true, width: "128px" },
        ]}
        rows={accounts.map((row) => ({
          id: row.id,
          href: adminRoutes.accounts(row.id),
          values: {
            email: row.email,
            name: row.name,
            role: row.role_id,
            status: row.status,
            seen: row.last_seen_at,
            created: row.created_at,
          },
          actions: <RowActions actions={[editAction(adminRoutes.accounts(row.id))]} />,
        }))}
      />
    </>
  );
}
