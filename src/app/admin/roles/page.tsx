import type { Metadata } from "next";
import Link from "next/link";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/data-table/DataTable";
import { RowActions } from "@/components/data-table/RowActions";
import { moveActions } from "@/components/data-table/row-actions";
import { buttonVariants } from "@/components/ui/button";
import { navIcon } from "@/config/admin-nav";
import { adminRoutes } from "@/config/routes";
import { can, sectionAccess } from "@/features/auth/access";
import { moveRole } from "@/features/roles/actions";
import { PermissionMatrix } from "@/features/roles/components/PermissionMatrix";
import { APPROVAL_SCOPE_LABEL, NEWS_SCOPE_LABEL } from "@/features/roles/labels";
import { SecurityForm } from "@/features/roles/components/RoleForms";
import { rolesOverview } from "@/features/roles/editorial";

export const metadata: Metadata = { title: "Roles & permissions" };

export default async function RolesPage() {
  const access = await sectionAccess("permissions");
  if (!access) return <NoAccess />;
  const { roles, permissions, security } = await rolesOverview();
  const canEdit = can(access.permissions, "permissions", "e");
  const canCreate = can(access.permissions, "permissions", "c");
  const canDelete = can(access.permissions, "permissions", "d");
  const granted: Record<string, Record<string, string>> = {};
  for (const row of permissions) (granted[row.role_id] ??= {})[row.section] = row.actions;
  const team = roles.filter((role) => role.id !== "reader");

  return (
    <>
      <PageHeader
        icon={navIcon(adminRoutes.roles)}
        title="Roles & permissions"
        lead="Who can do what in the administration. The database enforces everything — this is just where it's configured. You can't change your own role, and only an admin creates, changes or gives a role that edits everyone's articles, approves articles, or manages accounts, members or permissions."
        actions={
          <>
            <Link
              href={adminRoutes.switches.list}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Switches & maintenance
            </Link>
            <Link
              href={adminRoutes.audit}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Audit log
            </Link>
          </>
        }
      />

      <PermissionMatrix
        roles={team}
        granted={granted}
        ownRoleId={access.roleId}
        canEdit={canEdit}
        canCreate={canCreate}
        canDelete={canDelete}
      />

      <section className="mt-10">
        <h2 className="font-display mb-1 text-[18px] font-bold">Role order</h2>
        <p className="mb-4 text-[13px] text-[var(--color-ink-soft)]">
          The order of roles in the matrix and in the account and invitation forms.
        </p>
        <DataTable
          compact
          tableKey="admin-roles-order"
          caption="Roles in order"
          emptyTitle="No roles"
          initialSort={{ key: "order", dir: "asc" }}
          maxRowActions={2}
          columns={[
            { key: "order", label: "#", kind: "number", sortable: true, width: "64px" },
            {
              key: "name",
              label: "Role",
              sortable: true,
              filter: "text",
              width: "minmax(160px, 1fr)",
            },
            { key: "id", label: "Identifier", kind: "code", width: "160px" },
            { key: "news", label: "Whose articles they edit", sortable: true, filter: "select" },
            {
              key: "approval",
              label: "Which articles they approve",
              sortable: true,
              filter: "select",
            },
            { key: "holders", label: "Accounts", kind: "number", sortable: true, width: "96px" },
          ]}
          rows={team.map((role, index) => ({
            id: role.id,
            values: {
              order: index + 1,
              name: role.name,
              id: role.id,
              news:
                NEWS_SCOPE_LABEL[role.news_scope as keyof typeof NEWS_SCOPE_LABEL] ??
                role.news_scope,
              approval:
                APPROVAL_SCOPE_LABEL[role.approval_scope as keyof typeof APPROVAL_SCOPE_LABEL] ??
                role.approval_scope,
              holders: role.holders,
            },
            actions: canEdit ? (
              <RowActions
                actions={moveActions(
                  moveRole.bind(null, role.id, true),
                  moveRole.bind(null, role.id, false),
                  { first: index === 0, last: index === team.length - 1 },
                )}
              />
            ) : undefined,
          }))}
        />
      </section>

      {security ? (
        <section className="mt-10">
          <h2 className="font-display mb-4 text-[18px] font-bold">Security</h2>
          {canEdit ? (
            <SecurityForm
              settings={security}
              roles={roles.filter((role) => role.id !== "reader")}
            />
          ) : (
            <p className="text-[13px]">Sessions last {security.session_hours} h.</p>
          )}
        </section>
      ) : null}
    </>
  );
}
