import type { Metadata } from "next";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/data-table/DataTable";
import { RowActions } from "@/components/data-table/RowActions";
import { optionStats } from "@/components/data-table/stats";
import { navIcon } from "@/config/admin-nav";
import { sectionAccess } from "@/features/auth/access";
import { revokeMembership } from "@/features/members/actions";
import { GrantForm } from "@/features/members/components/MemberForms";
import { accountsWithoutMembership, listMemberships } from "@/features/members/editorial";
import { PLAN_LABEL } from "@/features/members/labels";

export const metadata: Metadata = { title: "Patron memberships" };

const PLANS = (["patron", "founding", "institution"] as const).map((plan) => ({
  value: plan,
  label: PLAN_LABEL[plan] ?? plan,
  tone: plan === "institution" ? ("accent" as const) : ("success" as const),
}));

/**
 * Atlas Patrons (ARCHITEKTURA 5.2, members section): read-only overview —
 * paid memberships are written only by the Stripe webhook; an admin may grant a free membership.
 */
export default async function MembersPage() {
  const access = await sectionAccess("members");
  if (!access) return <NoAccess />;
  const isAdmin = access.roleId === "admin";
  const [members, grantable] = await Promise.all([
    listMemberships(),
    isAdmin ? accountsWithoutMembership() : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader
        icon={navIcon("/admin/members")}
        title="Patron memberships"
        lead="Atlas Patron memberships of reader accounts. Paid memberships are managed by the payment gateway; here you get an overview and can grant complimentary ones."
      />
      {isAdmin ? (
        <section className="mb-10">
          <h2 className="font-display mb-3 text-[17px] font-bold">
            Grant a complimentary membership
          </h2>
          <GrantForm accounts={grantable} />
        </section>
      ) : null}
      <DataTable
        tableKey="admin-members"
        caption="Patron memberships"
        emptyTitle="No patron memberships yet"
        initialSort={{ key: "who", dir: "asc" }}
        stats={optionStats("plan", PLANS)}
        actionsWidth="48px"
        columns={[
          {
            key: "who",
            label: "Member account",
            sortable: true,
            filter: "text",
            width: "minmax(220px, 2fr)",
          },
          {
            key: "plan",
            label: "Membership",
            kind: "badge",
            options: PLANS,
            sortable: true,
            filter: "select",
          },
          { key: "status", label: "Status", sortable: true, filter: "select" },
          { key: "since", label: "Since", kind: "date", sortable: true, width: "128px" },
          { key: "renews", label: "Period ends", kind: "date", sortable: true, width: "128px" },
          {
            key: "read",
            label: "Pages read",
            kind: "number",
            align: "right",
            sortable: true,
            width: "112px",
          },
        ]}
        rows={members.map((row) => ({
          id: row.id ?? row.email ?? "",
          values: {
            who: row.name || row.email,
            plan: row.plan,
            status: row.complimentary ? "complimentary" : row.membership_status,
            since: row.paying_since,
            renews: row.current_period_end,
            read: row.pages_read ?? 0,
          },
          actions:
            isAdmin && row.complimentary && row.id ? (
              <RowActions
                actions={[
                  {
                    kind: "action",
                    icon: "revoke",
                    label: "Revoke complimentary membership",
                    danger: true,
                    action: revokeMembership.bind(null, row.id),
                    confirmTitle: `Revoke complimentary membership – ${row.name || row.email}?`,
                    confirmBody: "The account will no longer be an Atlas Patron.",
                    confirmLabel: "Revoke",
                  },
                ]}
              />
            ) : undefined,
        }))}
      />
    </>
  );
}
