import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { buttonVariants } from "@/components/ui/button";
import { ADMIN_NAV } from "@/config/admin-nav";
import { can, getAccess } from "@/features/auth/access";
import { approvalQueue, listEntries } from "@/features/entries/editorial";

export const metadata: Metadata = { title: "Přehled" };

/** Úvod administrace: co na mě čeká a kam dál (podle oprávnění). */
export default async function AdminHome() {
  const access = await getAccess();
  if (!access) return null;
  const writes = can(access.permissions, "news", "v");
  const approves = can(access.permissions, "approvals", "v");

  const [mine, queue] = await Promise.all([
    writes ? listEntries({ mine: true, userId: access.userId }) : Promise.resolve([]),
    approves ? approvalQueue() : Promise.resolve([]),
  ]);
  const returned = mine.filter((entry) => entry.status === "draft" && entry.review_note);
  const drafts = mine.filter((entry) => entry.status === "draft");
  const forMe = queue.filter((entry) => entry.canApprove);
  const sections = ADMIN_NAV.filter(
    (item) => item.section && can(access.permissions, item.section, "v"),
  );

  return (
    <>
      <PageHeader
        title="Přehled"
        lead={`Přihlášeni jako ${access.email} (${access.roleName}).`}
        actions={
          can(access.permissions, "news", "c") ? (
            <Link href="/admin/obsah/novy" className={buttonVariants()}>
              Nový článek
            </Link>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {writes ? (
          <Tile href="/admin/obsah?moje=1&stav=draft" value={drafts.length} label="mých konceptů" />
        ) : null}
        {writes ? (
          <Tile
            href="/admin/obsah?moje=1&stav=draft"
            value={returned.length}
            label="vráceno k úpravě"
            tone={returned.length ? "warn" : undefined}
          />
        ) : null}
        {approves ? (
          <Tile
            href="/admin/schvalovani"
            value={forMe.length}
            label="čeká na mé schválení"
            tone={forMe.length ? "warn" : undefined}
          />
        ) : null}
      </div>

      {returned.length ? (
        <section className="mt-10">
          <h2 className="font-display mb-3 text-[17px] font-bold">Vráceno k úpravě</h2>
          <ul className="grid gap-2">
            {returned.map((entry) => (
              <li key={entry.id} className="rounded-xl border border-amber-300 bg-amber-50 p-3">
                <Link href={`/admin/obsah/${entry.id}`} className="font-medium hover:underline">
                  {entry.title}
                </Link>
                <p className="mt-1 text-[13px] whitespace-pre-line">{entry.review_note}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-10">
        <h2 className="font-display mb-3 text-[17px] font-bold">Vaše sekce</h2>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="flex min-h-(--touch-min) items-center gap-3 rounded-xl border border-[var(--color-line)] px-4 py-3 text-[14px] transition hover:border-[var(--color-accent)]"
              >
                <item.icon size={18} aria-hidden />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function Tile({
  href,
  value,
  label,
  tone,
}: {
  href: string;
  value: number;
  label: string;
  tone?: "warn";
}) {
  return (
    <Link
      href={href}
      className={`rounded-2xl border p-5 transition hover:border-[var(--color-accent)] ${
        tone === "warn" ? "border-amber-300 bg-amber-50" : "border-[var(--color-line)]"
      }`}
    >
      <span className="font-display block text-[32px] leading-none font-bold">{value}</span>
      <span className="mt-2 block text-[13px] text-[var(--color-ink-soft)]">{label}</span>
    </Link>
  );
}
