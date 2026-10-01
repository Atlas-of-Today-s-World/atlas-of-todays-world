import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { sectionAccess } from "@/features/auth/access";
import { AccountForm } from "@/features/accounts/components/AccountForm";
import { accountForEdit, listAccounts, listRoles } from "@/features/accounts/editorial";
import { getPickerOptions } from "@/features/geography/queries";
import { uuid } from "@/lib/validation/common";

export const metadata: Metadata = { title: "Účet" };

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
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
  // Roli admin nabízí jen admin; ostatním ji DB stejně nedovolí dát.
  const offered = roles.filter((role) => isAdmin || !role.locked || role.id === account.role_id);

  return (
    <>
      <PageHeader title={account.name || account.email} lead={account.email} />
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
