import type { Metadata } from "next";
import { DataTable } from "@/components/admin/DataTable";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { listRoles } from "@/features/accounts/editorial";
import { can, sectionAccess } from "@/features/auth/access";
import { getPickerOptions } from "@/features/geography/queries";
import { SITE_URL } from "@/lib/site";
import { createServerClient } from "@/lib/supabase/server";
import InvitationForm from "./InvitationForm";

/** Prošlá pozvánka (stránka je dynamická, „teď" = čas požadavku). */
const isPast = (iso: string) => new Date(iso).getTime() < Date.now();
import RevokeButton from "./RevokeButton";

export const metadata: Metadata = { title: "Pozvánky" };

const dateFormat = new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium", timeStyle: "short" });

export default async function InvitationsPage() {
  const access = await sectionAccess("users");
  if (!access) return <NoAccess />;

  const supabase = await createServerClient();
  const [{ data: invitations }, roles, { countries }] = await Promise.all([
    supabase
      .from("invitations")
      .select("id, email, role_id, created_at, expires_at, accepted_at, revoked_at")
      .order("created_at", { ascending: false })
      .limit(100),
    listRoles(),
    getPickerOptions(),
  ]);
  const roleName = new Map(roles.map((role) => [role.id, role.name]));
  const isAdmin = access.roleId === "admin";
  const canRevoke = can(access.permissions, "users", "e");

  return (
    <>
      <PageHeader
        title="Pozvánky"
        lead={
          <>
            Do týmu se vstupuje jen pozvánkou. Pozvaný se přihlásí přes Google{" "}
            <strong>stejným e-mailem</strong> a dostane roli z pozvánky. Pozvánka platí 5 dní. Dokud
            nejsou zapnuté e-maily z Atlasu, pošlete mu odkaz{" "}
            <code className="text-[13px]">{SITE_URL}/pozvanka</code> sami.
          </>
        }
      />

      {can(access.permissions, "users", "c") ? (
        <InvitationForm
          roles={roles.filter((role) => role.id !== "reader" && (isAdmin || !role.locked))}
          countries={countries}
          isAdmin={isAdmin}
        />
      ) : null}

      <h2 className="font-display mt-12 mb-3 text-[18px] font-bold">Odeslané pozvánky</h2>
      <DataTable
        caption="Pozvánky"
        rows={invitations ?? []}
        rowKey={(invite) => invite.id}
        empty="Zatím žádné pozvánky."
        columns={[
          { key: "email", header: "E-mail", cell: (invite) => invite.email },
          {
            key: "role",
            header: "Role",
            cell: (invite) => roleName.get(invite.role_id) ?? invite.role_id,
          },
          {
            key: "state",
            header: "Stav",
            cell: (invite) =>
              invite.accepted_at
                ? "přijatá"
                : invite.revoked_at
                  ? "odvolaná"
                  : isPast(invite.expires_at)
                    ? "prošlá"
                    : `platí do ${dateFormat.format(new Date(invite.expires_at))}`,
          },
          {
            key: "actions",
            header: "",
            end: true,
            cell: (invite) =>
              canRevoke && !invite.accepted_at && !invite.revoked_at ? (
                <RevokeButton id={invite.id} email={invite.email} />
              ) : null,
          },
        ]}
      />
    </>
  );
}
