import type { Metadata } from "next";
import Link from "next/link";
import { DataTable } from "@/components/admin/DataTable";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { sectionAccess } from "@/features/auth/access";
import { approvalQueue } from "@/features/entries/editorial";

export const metadata: Metadata = { title: "Approvals" };

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

/**
 * Fronta ke schválení (ARCHITEKTURA 5.2, E3): čekající články od nejstaršího.
 * Kdo co smí schválit, spočítá DB (`can_approve_entry`) — globálně, podle
 * přidělených zemí či autorů; vlastní článek neschvaluje nikdo kromě admina.
 */
export default async function ApprovalsPage() {
  if (!(await sectionAccess("approvals"))) return <NoAccess />;
  const queue = await approvalQueue();
  const mine = queue.filter((row) => row.canApprove);
  const others = queue.filter((row) => !row.canApprove);

  return (
    <>
      <PageHeader
        title="Approvals"
        lead="Articles waiting for a second pair of eyes. Open an article, compare it with the published version, then approve it or return it with a note."
      />
      <h2 className="font-display mb-3 text-[17px] font-bold">You can approve ({mine.length})</h2>
      <Queue rows={mine} empty="Nothing is waiting for you." />
      {others.length ? (
        <>
          <h2 className="font-display mt-10 mb-3 text-[17px] font-bold">
            Waiting for other approvers ({others.length})
          </h2>
          <Queue rows={others} empty="" />
        </>
      ) : null}
    </>
  );
}

function Queue({
  rows,
  empty,
}: {
  rows: Awaited<ReturnType<typeof approvalQueue>>;
  empty: string;
}) {
  return (
    <DataTable
      caption="Pending articles"
      rows={rows}
      rowKey={(row) => row.id}
      empty={empty}
      columns={[
        {
          key: "title",
          header: "Title",
          cell: (row) => (
            <Link href={`/admin/content/${row.id}`} className="font-medium hover:underline">
              {row.title}
            </Link>
          ),
        },
        { key: "category", header: "Category", cell: (row) => row.category, wide: true },
        { key: "author", header: "Author", cell: (row) => row.author_name ?? "—", wide: true },
        {
          key: "scheduled",
          header: "Scheduled",
          cell: (row) => (row.publish_at ? dateFormat.format(new Date(row.publish_at)) : "—"),
          wide: true,
        },
        {
          key: "waiting",
          header: "Submitted",
          cell: (row) => dateFormat.format(new Date(row.updated_at)),
          end: true,
        },
      ]}
    />
  );
}
