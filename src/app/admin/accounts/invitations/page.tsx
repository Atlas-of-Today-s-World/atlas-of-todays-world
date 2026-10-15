import type { Metadata } from "next";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/data-table/DataTable";
import { RowActions } from "@/components/data-table/RowActions";
import { optionStats } from "@/components/data-table/stats";
import { navIcon } from "@/config/admin-nav";
import { adminRoutes } from "@/config/routes";
import { listRoles } from "@/features/roles/editorial";
import { can, sectionAccess } from "@/features/auth/access";
import { getPickerOptions } from "@/features/geography/queries";
import { confirmAction } from "@/components/data-table/row-actions";
import { listAccounts } from "@/features/accounts/editorial";
import {
  extendInvitation,
  resendInvitation,
  revokeInvitation,
} from "@/features/invitations/actions";
import { INVITATION_DAYS } from "@/features/invitations/schema";
import { listInvitations } from "@/features/invitations/editorial";
import { SITE_URL } from "@/lib/site";
import InvitationForm from "./InvitationForm";

/** Expired invitation (the page is dynamic, "now" = request time). */
const isPast = (iso: string) => new Date(iso).getTime() < Date.now();

export const metadata: Metadata = { title: "Team invitations" };

const STATE = [
  { value: "valid", label: "Valid", tone: "accent" as const },
  { value: "accepted", label: "Accepted", tone: "success" as const },
  { value: "expired", label: "Expired", tone: "warning" as const },
  { value: "revoked", label: "Revoked", tone: "neutral" as const },
];

export default async function InvitationsPage() {
  const access = await sectionAccess("users");
  if (!access) return <NoAccess />;

  const [invitations, roles, { countries }, staff] = await Promise.all([
    listInvitations(),
    listRoles(),
    getPickerOptions(),
    listAccounts("staff"),
  ]);
  const isAdmin = access.roleId === "admin";
  const canRevoke = can(access.permissions, "users", "e");

  return (
    <>
      <PageHeader
        icon={navIcon(adminRoutes.accounts.list)}
        title="Team invitations"
        lead={
          <>
            The team is invitation-only. The invitee signs in with Google using{" "}
            <strong>the same email</strong> and gets the role from the invitation. Invitations are
            valid for {INVITATION_DAYS} days; resending or extending one makes it valid for{" "}
            {INVITATION_DAYS} days from then. Until Atlas emails are enabled, send them the link{" "}
            <code className="text-[13px]">{SITE_URL}/pozvanka</code> yourself.
          </>
        }
      />

      {can(access.permissions, "users", "c") ? (
        <InvitationForm
          roles={roles.filter((role) => role.id !== "reader" && (isAdmin || !role.locked))}
          countries={countries}
          isAdmin={isAdmin}
          authors={staff.map((person) => ({
            id: person.id,
            label: person.name || person.email,
          }))}
        />
      ) : null}

      <div className="mt-10">
        <DataTable
          tableKey="admin-invitations"
          caption="Sent invitations"
          emptyTitle="No team invitations yet"
          initialSort={{ key: "created", dir: "desc" }}
          stats={optionStats("state", STATE)}
          maxRowActions={3}
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
          rows={invitations.map((invite) => {
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
                      confirmAction(
                        "send",
                        "Resend invitation",
                        resendInvitation.bind(null, invite.id),
                        `Send the invitation to ${invite.email} again?`,
                        `It becomes valid for ${INVITATION_DAYS} days from now and, when Atlas e-mails are on, the invitee gets a fresh link.`,
                      ),
                      confirmAction(
                        "extend",
                        "Extend",
                        extendInvitation.bind(null, invite.id),
                        `Extend the invitation for ${invite.email}?`,
                        `It becomes valid for ${INVITATION_DAYS} days from now. No e-mail is sent.`,
                      ),
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
