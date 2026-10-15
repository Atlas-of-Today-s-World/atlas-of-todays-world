import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { sectionAccess } from "@/features/auth/access";
import { AccountForm } from "@/features/accounts/components/AccountForm";
import { accountForEdit, listAccounts } from "@/features/accounts/editorial";
import { listRoles } from "@/features/roles/editorial";
import { getPickerOptions } from "@/features/geography/queries";
import { formatDateTime } from "@/lib/format";
import { uuid } from "@/lib/validation/common";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage({ params }: PageProps<"/admin/accounts/[id]">) {
  const access = await sectionAccess("users");
  if (!access) return <NoAccess />;
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();

  const [account, roles, staff, { countries }] = await Promise.all([
    accountForEdit(id),
    listRoles(),
    listAccounts("staff"),
    getPickerOptions(),
  ]);
  if (!account) notFound();
  const isAdmin = access.roleId === "admin";
  // Only an admin is offered the admin role; the DB wouldn't let others grant it anyway.
  const offered = roles.filter((role) => isAdmin || !role.locked || role.id === account.role_id);

  return (
    <>
      <PageHeader
        title={account.name || account.email}
        lead={
          account.deleted_at ? (
            <>
              {account.email} · <strong>Deleted</strong> on {formatDateTime(account.deleted_at)} —
              the account can no longer sign in to the administration.
            </>
          ) : (
            account.email
          )
        }
      />
      <AccountForm
        account={account}
        roles={offered}
        countries={countries}
        authors={staff
          .filter((person) => person.id !== account.id)
          .map((person) => ({ id: person.id, label: person.name || person.email }))}
        isAdmin={isAdmin}
        isSelf={account.id === access.userId}
      />
    </>
  );
}
