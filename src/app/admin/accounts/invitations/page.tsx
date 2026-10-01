import type { Metadata } from "next";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/data-table/DataTable";
import { RowActions } from "@/components/data-table/RowActions";
import { optionStats } from "@/components/data-table/stats";
import { navIcon } from "@/config/admin-nav";
import { listRoles } from "@/features/accounts/editorial";
import { can, sectionAccess } from "@/features/auth/access";
import { getPickerOptions } from "@/features/geography/queries";
import { revokeInvitation } from "@/features/invitations/actions";
import { SITE_URL } from "@/lib/site";
import { createServerClient } from "@/lib/supabase/server";
import InvitationForm from "./InvitationForm";

/** Prošlá pozvánka (stránka je dynamická, „teď" = čas požadavku). */
const isPast = (iso: string) => new Date(iso).getTime() < Date.now();

export const metadata: Metadata = { title: "Invitations" };

const STATE = [
  { value: "valid", label: "Valid", tone: "accent" as const },
  { value: "accepted", label: "Accepted", tone: "success" as const },
  { value: "expired", label: "Expired", tone: "warning" as const },
  { value: "revoked", label: "Revoked", tone: "neutral" as const },
];

export default async function InvitationsPage() {
  const access = await sectionAccess("users");
  if (!access) return <NoAccess />;

  const supabase = await createServerClient();
  const [{ data: invitations }, roles, { countries }] = await Promise.all([
    supabase
      .from("invitations")
      .select("id, email, role_id, created_at, expires_at, accepted_at, revoked_at")
      .order("created_at", { ascending: false })
      .limit(500),
    listRoles(),
    getPickerOptions(),
  ]);
  const isAdmin = access.roleId === "admin";
  const canRevoke = can(access.permissions, "users", "e");

  return (
    <>
      <PageHeader
        icon={navIcon("/admin/accounts")}
        title="Invitations"
        lead={
          <>
            The team is invitation-only. The invitee signs in with Google using{" "}
            <strong>the same email</strong> and gets the role from the invitation. Invitations are
            valid for 5 days. Until Atlas emails are enabled, send them the link{" "}
            <code className="text-[13px]">{SITE_URL}/pozvanka</code> yourself.
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

      <div className="mt-10">
        <DataTable
          tableKey="admin-invitations"
          caption="Sent invitations"
          emptyTitle="No invitations yet"
          initialSort={{ key: "created", dir: "desc" }}
          stats={optionStats("state", STATE)}
          actionsWidth="48px"
          columns={[
            {
              key: "email",
              label: "Email",
              sortable: true,
              filter: "text",
              width: "minmax(220px, 2fr)",
            },
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
              key: "state",
              label: "State",
              kind: "badge",
              options: STATE,
              sortable: true,
              filter: "select",
              width: "120px",
            },
            { key: "expires", label: "Valid until", kind: "datetime", sortable: true },
            { key: "created", label: "Sent", kind: "date", sortable: true, width: "128px" },
          ]}
          rows={(invitations ?? []).map((invite) => {
            const state = invite.accepted_at
              ? "accepted"
              : invite.revoked_at
                ? "revoked"
                : isPast(invite.expires_at)
                  ? "expired"
                  : "valid";
            return {
              id: invite.id,
              values: {
                email: invite.email,
                role: invite.role_id,
                state,
                expires: invite.expires_at,
                created: invite.created_at,
              },
              actions:
                canRevoke && !invite.accepted_at && !invite.revoked_at ? (
                  <RowActions
                    actions={[
                      {
                        kind: "action",
                        icon: "revoke",
                        label: "Revoke",
                        danger: true,
                        action: revokeInvitation.bind(null, invite.id),
                        confirmTitle: "Revoke invitation?",
                        confirmBody: `${invite.email} will not become a team member after signing in.`,
                      },
                    ]}
                  />
                ) : undefined,
            };
          })}
        />
      </div>
    </>
  );
}
