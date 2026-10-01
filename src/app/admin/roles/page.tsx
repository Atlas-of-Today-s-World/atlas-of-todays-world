import type { Metadata } from "next";
import Link from "next/link";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { buttonVariants } from "@/components/ui/button";
import { can, sectionAccess } from "@/features/auth/access";
import {
  DeleteRole,
  MatrixForm,
  RoleForm,
  SecurityForm,
} from "@/features/roles/components/RoleForms";
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
  const granted = (roleId: string) =>
    Object.fromEntries(
      permissions.filter((p) => p.role_id === roleId).map((p) => [p.section, p.actions]),
    );

  return (
    <>
      <PageHeader
        title="Roles & permissions"
        lead="Who can do what in the administration. The database enforces everything — this is just where it's configured. You can't change your own role, and only an admin can grant account or permission management."
        actions={
          <Link href="/admin/roles/audit" className={buttonVariants({ variant: "outline" })}>
            Audit log
          </Link>
        }
      />

      <div className="grid gap-6">
        {roles
          .filter((role) => role.id !== "reader")
          .map((role) => (
            <details
              key={role.id}
              className="rounded-2xl border border-[var(--color-line)] p-5 open:pb-6"
            >
              <summary className="flex min-h-(--touch-min) cursor-pointer flex-wrap items-center gap-x-3">
                <span className="font-display text-[17px] font-bold">{role.name}</span>
                <span className="text-[12.5px] text-[var(--color-ink-muted)]">
                  {role.holders} {role.holders === 1 ? "account" : "accounts"}
                  {role.locked ? " · locked" : ""}
                </span>
              </summary>
              <p className="mt-2 text-[13px] text-[var(--color-ink-soft)]">{role.note}</p>
              <div className="mt-5 grid gap-8 xl:grid-cols-2">
                <MatrixForm
                  roleId={role.id}
                  roleName={role.name}
                  granted={granted(role.id)}
                  readOnly={role.locked || !canEdit || role.id === access.roleId}
                />
                {canEdit && !role.locked ? <RoleForm role={role} /> : null}
              </div>
              {canDelete && !role.locked && role.holders === 0 ? (
                <div className="mt-4">
                  <DeleteRole id={role.id} name={role.name} />
                </div>
              ) : null}
            </details>
          ))}
      </div>

      {canCreate ? (
        <section className="mt-12 max-w-2xl rounded-2xl border border-[var(--color-line)] p-5">
          <h2 className="font-display mb-4 text-[18px] font-bold">New role</h2>
          <RoleForm role={null} />
        </section>
      ) : null}

      <section className="mt-12">
        <h2 className="font-display mb-4 text-[18px] font-bold">Operations & feature flags</h2>
        <ul className="grid max-w-2xl gap-3">
          {(flags ?? []).map((flag) => (
            <li
              key={flag.key}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-line)] p-4"
            >
              <span>
                <code className="text-[13px] font-medium">{flag.key}</code>{" "}
                <span className={flag.enabled ? "text-green-800" : "text-[var(--color-ink-muted)]"}>
                  {flag.enabled ? "on" : "off"}
                </span>
                <span className="mt-1 block text-[12.5px] text-[var(--color-ink-muted)]">
                  {flag.note}
                </span>
              </span>
              {canEdit ? (
                <FlagToggle flagKey={flag.key} enabled={flag.enabled} label={flag.key} />
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {security ? (
        <section className="mt-12">
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
