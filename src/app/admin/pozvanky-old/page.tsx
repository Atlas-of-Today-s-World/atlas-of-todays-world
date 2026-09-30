import type { Metadata } from "next";
import { can, getAccess } from "@/features/auth/access";
import { SITE_URL } from "@/lib/site";
import { createServerClient } from "@/lib/supabase/server";
import InvitationForm from "./InvitationForm";
import RevokeButton from "./RevokeButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Tým a pozvánky" };

const dateFormat = new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium", timeStyle: "short" });

export default async function InvitationsPage() {
  const access = await getAccess();
  if (!access || !can(access.permissions, "users", "v")) {
    return <p className="text-[14px]">Na správu týmu nemáte oprávnění.</p>;
  }

  const supabase = await createServerClient();
  const [{ data: invitations }, { data: roles }, { data: team }] = await Promise.all([
    supabase
      .from("invitations")
      .select("id, email, role_id, created_at, expires_at, accepted_at, revoked_at")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("roles").select("id, name, locked, position").order("position"),
    supabase
      .from("profiles")
      .select("id, email, name, role_id, status")
      .eq("kind", "staff")
      .is("deleted_at", null)
      .order("email"),
  ]);
  const roleName = new Map((roles ?? []).map((role) => [role.id, role.name]));
  const now = Date.now();
  const inviteLink = `${SITE_URL}/pozvanka`;

  return (
    <main>
      <h1 className="font-display text-[28px] font-bold">Tým a pozvánky</h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-[var(--color-ink-soft)]">
        Do týmu se vstupuje jen pozvánkou. Pozvaný se přihlásí přes Google{" "}
        <strong>stejným e-mailem</strong> a dostane roli z pozvánky. Pozvánka platí 5 dní. Dokud
        nejsou zapnuté e-maily z Atlasu, pošlete mu odkaz{" "}
        <code className="text-[13px]">{inviteLink}</code> sami.
      </p>

      {can(access.permissions, "users", "c") ? (
        <InvitationForm
          roles={(roles ?? [])
            .filter((role) => role.id !== "reader")
            .map((role) => ({ id: role.id, name: role.name }))}
        />
      ) : null}

      <h2 className="font-display mt-12 text-[18px] font-bold">Pozvánky</h2>
      <table className="mt-4 w-full text-left text-[13px]">
        <thead className="text-[var(--color-ink-muted)]">
          <tr>
            <th className="py-2 pr-4 font-medium">E-mail</th>
            <th className="py-2 pr-4 font-medium">Role</th>
            <th className="py-2 pr-4 font-medium">Stav</th>
            <th className="py-2 font-medium">
              <span className="sr-only">Akce</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {(invitations ?? []).map((invite) => {
            const state = invite.accepted_at
              ? "přijatá"
              : invite.revoked_at
                ? "odvolaná"
                : new Date(invite.expires_at).getTime() < now
                  ? "prošlá"
                  : `platí do ${dateFormat.format(new Date(invite.expires_at))}`;
            const open = !invite.accepted_at && !invite.revoked_at;
            return (
              <tr key={invite.id} className="border-t border-[var(--color-line)]">
                <td className="py-2 pr-4">{invite.email}</td>
                <td className="py-2 pr-4">{roleName.get(invite.role_id) ?? invite.role_id}</td>
                <td className="py-2 pr-4">{state}</td>
                <td className="py-2">
                  {open && can(access.permissions, "users", "e") ? (
                    <RevokeButton id={invite.id} />
                  ) : null}
                </td>
              </tr>
            );
          })}
          {!invitations?.length ? (
            <tr>
              <td colSpan={4} className="py-3 text-[var(--color-ink-muted)]">
                Zatím žádné pozvánky.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <h2 className="font-display mt-12 text-[18px] font-bold">Tým</h2>
      <ul className="mt-4 grid gap-1 text-[13px]">
        {(team ?? []).map((member) => (
          <li key={member.id}>
            {member.name || member.email} — {roleName.get(member.role_id) ?? member.role_id}
            {member.status !== "active" ? ` (${member.status})` : ""}
          </li>
        ))}
      </ul>
    </main>
  );
}
