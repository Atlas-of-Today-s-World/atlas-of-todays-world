import type { Metadata } from "next";
import { DataTable } from "@/components/admin/DataTable";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { sectionAccess } from "@/features/auth/access";
import { GrantForm, PLAN_LABEL, RevokeMembership } from "@/features/members/components/MemberForms";
import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Členové" };

const dateFormat = new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium" });

/**
 * Atlas Patrons (ARCHITEKTURA 5.2, sekce members): přehled jen pro čtení —
 * placená členství zapisuje výhradně Stripe webhook; admin smí dát členství zdarma.
 */
export default async function MembersPage() {
  const access = await sectionAccess("members");
  if (!access) return <NoAccess />;
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("members_overview")
    .select(
      "id, name, email, plan, membership_status, complimentary, paying_since, current_period_end, pages_read",
    )
    .order("email")
    .limit(2000);
  if (error) throw new Error(`[members] ${error.message}`);
  const all = data ?? [];
  const members = all.filter((row) => row.plan !== "none");
  const isAdmin = access.roleId === "admin";

  return (
    <>
      <PageHeader
        title="Členové"
        lead="Atlas Patrons. Placená členství spravuje platební brána; tady je jen přehled a členství zdarma."
      />
      {isAdmin ? (
        <section className="mb-10">
          <h2 className="font-display mb-3 text-[17px] font-bold">Členství zdarma</h2>
          <GrantForm
            accounts={all
              .filter((row) => row.plan === "none")
              .map((row) => ({ id: row.id ?? "", label: row.name || row.email || "" }))}
          />
        </section>
      ) : null}
      <DataTable
        caption="Členové"
        rows={members}
        rowKey={(row) => row.id ?? ""}
        empty="Zatím žádní členové."
        columns={[
          { key: "who", header: "Účet", cell: (row) => row.name || row.email },
          { key: "plan", header: "Členství", cell: (row) => PLAN_LABEL[row.plan ?? "none"] },
          {
            key: "status",
            header: "Stav",
            cell: (row) => (row.complimentary ? "zdarma" : (row.membership_status ?? "—")),
          },
          {
            key: "since",
            header: "Od",
            wide: true,
            cell: (row) => (row.paying_since ? dateFormat.format(new Date(row.paying_since)) : "—"),
          },
          {
            key: "read",
            header: "Přečteno stránek",
            wide: true,
            cell: (row) => row.pages_read ?? 0,
          },
          {
            key: "actions",
            header: "",
            end: true,
            cell: (row) =>
              isAdmin && row.complimentary && row.id ? (
                <RevokeMembership userId={row.id} label={row.name || row.email || ""} />
              ) : null,
          },
        ]}
      />
    </>
  );
}
