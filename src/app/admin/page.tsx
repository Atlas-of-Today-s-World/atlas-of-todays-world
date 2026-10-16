import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { buttonVariants } from "@/components/ui/button";
import { ADMIN_NAV, navVisible } from "@/config/admin-nav";
import { adminRoutes } from "@/config/routes";
import { can, getAccess } from "@/features/auth/access";
import { approvalQueue, listEntries } from "@/features/entries/editorial";
import { ConversionsCard } from "@/features/conversions/components/ConversionsCard";
import { conversionSummary } from "@/features/conversions/editorial";

export const metadata: Metadata = { title: "Overview" };

/** Admin home: what's waiting for me and where to go next (by permissions). */
export default async function AdminHome() {
  const access = await getAccess();
  if (!access) return null;
  const writes = can(access.permissions, "news", "v");
  const approves = can(access.permissions, "approvals", "v");
  // Conversions belong to the people who look after patrons and supporters (RLS: members "v").
  const seesConversions = can(access.permissions, "members", "v");

  const [mine, queue, conversions] = await Promise.all([
    writes ? listEntries({ mine: true, userId: access.userId }) : Promise.resolve([]),
    approves ? approvalQueue() : Promise.resolve([]),
    seesConversions ? conversionSummary() : Promise.resolve(null),
  ]);
  const returned = mine.filter((entry) => entry.status === "draft" && entry.review_note);
  const drafts = mine.filter((entry) => entry.status === "draft");
  const forMe = queue.filter((entry) => entry.canApprove);
  const sections = ADMIN_NAV.filter(
    (item) => item.section !== null && navVisible(item, access.permissions),
  );

  return (
    <>
      <PageHeader
        title="Overview"
        lead={`Signed in as ${access.email} (${access.roleName}).`}
        actions={
          can(access.permissions, "news", "c") ? (
            <span className="flex flex-wrap gap-2">
              <Link href={adminRoutes.newTopic} className={buttonVariants()}>
                New topic
              </Link>
              <Link
                href={adminRoutes.content.new}
                className={buttonVariants({ variant: "outline" })}
              >
                New news item
              </Link>
            </span>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {writes ? (
          <Tile href={adminRoutes.myDrafts} value={drafts.length} label="my drafts" />
        ) : null}
        {writes ? (
          <Tile
            href={adminRoutes.myDrafts}
            value={returned.length}
            label="my drafts returned for changes"
            tone={returned.length ? "warn" : undefined}
          />
        ) : null}
        {approves ? (
          <Tile
            href={adminRoutes.approvals}
            value={forMe.length}
            label="topics and news awaiting my approval"
            tone={forMe.length ? "warn" : undefined}
          />
        ) : null}
      </div>

      {returned.length ? (
        <section className="mt-10">
          <h2 className="font-display mb-3 text-[17px] font-bold">
            Drafts returned to you for changes
          </h2>
          <ul className="grid gap-2">
            {returned.map((entry) => (
              <li key={entry.id} className="rounded-xl border border-amber-300 bg-amber-50 p-3">
                <Link href={adminRoutes.content(entry.id)} className="font-medium hover:underline">
                  {entry.title}
                </Link>
                <p className="mt-1 text-[13px] whitespace-pre-line">{entry.review_note}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {seesConversions ? <ConversionsCard summary={conversions} /> : null}

      <section className="mt-10">
        <h2 className="font-display mb-3 text-[17px] font-bold">Sections you can open</h2>
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
