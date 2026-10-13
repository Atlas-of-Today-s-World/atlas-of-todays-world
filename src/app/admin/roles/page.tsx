import type { Metadata } from "next";
import Link from "next/link";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { buttonVariants } from "@/components/ui/button";
import { navIcon } from "@/config/admin-nav";
import { adminRoutes } from "@/config/routes";
import { can, sectionAccess } from "@/features/auth/access";
import { PermissionMatrix } from "@/features/roles/components/PermissionMatrix";
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

  return (
    <>
      <PageHeader
        icon={navIcon(adminRoutes.roles)}
        title="Roles & permissions"
        lead="Who can do what in the administration. The database enforces everything — this is just where it's configured. You can't change your own role, and only an admin can grant account or permission management."
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
        roles={roles.filter((role) => role.id !== "reader")}
        granted={granted}
        ownRoleId={access.roleId}
        canEdit={canEdit}
        canCreate={canCreate}
        canDelete={canDelete}
      />

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
