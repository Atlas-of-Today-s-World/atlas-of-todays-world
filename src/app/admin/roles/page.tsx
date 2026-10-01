import type { Metadata } from "next";
import Link from "next/link";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/data-table/DataTable";
import { buttonVariants } from "@/components/ui/button";
import { navIcon } from "@/config/admin-nav";
import { can, sectionAccess } from "@/features/auth/access";
import { PermissionMatrix } from "@/features/roles/components/PermissionMatrix";
import { SecurityForm } from "@/features/roles/components/RoleForms";
import { FlagToggle } from "@/features/flags/components/FlagToggle";
import { rolesOverview } from "@/features/roles/editorial";
import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Roles & permissions" };

export default async function RolesPage() {
  const access = await sectionAccess("permissions");
  if (!access) return <NoAccess />;
  const [{ roles, permissions, security }, { data: flags }] = await Promise.all([
    rolesOverview(),
    createServerClient().then((db) =>
      db.from("feature_flags").select("key, enabled, note").order("key"),
    ),
  ]);
  const canEdit = can(access.permissions, "permissions", "e");
  const canCreate = can(access.permissions, "permissions", "c");
  const canDelete = can(access.permissions, "permissions", "d");
  const granted: Record<string, Record<string, string>> = {};
  for (const row of permissions) (granted[row.role_id] ??= {})[row.section] = row.actions;

  return (
    <>
      <PageHeader
        icon={navIcon("/admin/roles")}
        title="Roles & permissions"
        lead="Who can do what in the administration. The database enforces everything — this is just where it's configured. You can't change your own role, and only an admin can grant account or permission management."
        actions={
          <Link
            href="/admin/roles/audit"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Audit log
          </Link>
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

      <section className="mt-10">
        <h2 className="font-display mb-3 text-[18px] font-bold">Operations & feature flags</h2>
        <DataTable
          compact
          tableKey="admin-flags"
          caption="Feature flags"
          emptyTitle="No feature flags"
          actionsWidth="112px"
          columns={[
            { key: "key", label: "Flag", kind: "code", sortable: true, width: "220px" },
            {
              key: "state",
              label: "State",
              kind: "badge",
              options: [
                { value: "on", label: "On", tone: "success" },
                { value: "off", label: "Off", tone: "neutral" },
              ],
              width: "96px",
            },
            { key: "note", label: "Note", width: "minmax(240px, 3fr)" },
          ]}
          rows={(flags ?? []).map((flag) => ({
            id: flag.key,
            values: { key: flag.key, state: flag.enabled ? "on" : "off", note: flag.note },
            actions: canEdit ? (
              <FlagToggle flagKey={flag.key} enabled={flag.enabled} label={flag.key} />
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
