import type { Metadata } from "next";
import Link from "next/link";
import { DataTable } from "@/components/admin/DataTable";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { sectionAccess } from "@/features/auth/access";
import { approvalQueue } from "@/features/entries/editorial";

export const metadata: Metadata = { title: "Schvalování" };

const dateFormat = new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium", timeStyle: "short" });

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
        title="Schvalování"
        lead="Články čekající na druhé oči. Otevřete článek, porovnejte ho se zveřejněnou verzí a schvalte, nebo ho vraťte s poznámkou."
      />
      <h2 className="font-display mb-3 text-[17px] font-bold">Můžete schválit ({mine.length})</h2>
      <Queue rows={mine} empty="Nic na vás nečeká." />
      {others.length ? (
        <>
          <h2 className="font-display mt-10 mb-3 text-[17px] font-bold">
            Čeká na jiné schvalovatele ({others.length})
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
      caption="Čekající články"
      rows={rows}
      rowKey={(row) => row.id}
      empty={empty}
      columns={[
        {
          key: "title",
          header: "Titulek",
          cell: (row) => (
            <Link href={`/admin/obsah/${row.id}`} className="font-medium hover:underline">
              {row.title}
            </Link>
          ),
        },
        { key: "category", header: "Kategorie", cell: (row) => row.category, wide: true },
        { key: "author", header: "Autor", cell: (row) => row.author_name ?? "—", wide: true },
        {
          key: "scheduled",
          header: "Naplánováno",
          cell: (row) => (row.publish_at ? dateFormat.format(new Date(row.publish_at)) : "—"),
          wide: true,
        },
        {
          key: "waiting",
          header: "Odesláno",
          cell: (row) => dateFormat.format(new Date(row.updated_at)),
          end: true,
        },
      ]}
    />
  );
}
