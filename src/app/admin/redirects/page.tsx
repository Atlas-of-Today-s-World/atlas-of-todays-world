import type { Metadata } from "next";
import { DataTable } from "@/components/admin/DataTable";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { Input } from "@/components/ui/field";
import { can, sectionAccess } from "@/features/auth/access";
import { DeleteRedirect, RedirectForm } from "@/features/redirects/components/RedirectForms";
import { listRedirects } from "@/features/redirects/editorial";

export const metadata: Metadata = { title: "Redirects" };

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

/**
 * Správa přesměrování (G3). Přesměrování se uplatní jen místo stránky 404 —
 * existující stránku nepřebije. Kdo smí přidat a smazat, hlídá RLS (sekce news).
 */
export default async function RedirectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const access = await sectionAccess("news");
  if (!access) return <NoAccess />;
  const { q } = await searchParams;
  const rows = await listRedirects(q);
  const canDelete = can(access.permissions, "news", "d");

  return (
    <>
      <PageHeader
        title="Redirects"
        lead="When an article's or page's address changes, add a redirect from the old path to the new one. It applies only where the page would otherwise be “not found” — it never overrides an existing page."
      />

      {can(access.permissions, "news", "c") ? <RedirectForm /> : null}

      <div className="mt-12 mb-3 flex flex-wrap items-center gap-3">
        <h2 className="font-display text-[18px] font-bold">List ({rows.length})</h2>
        <form action="/admin/redirects" className="ml-auto">
          <label htmlFor="q" className="sr-only">
            Search redirects
          </label>
          <Input id="q" name="q" type="search" placeholder="Path…" defaultValue={q} />
        </form>
      </div>
      <DataTable
        caption="Redirects"
        rows={rows}
        rowKey={(row) => row.id}
        empty="No redirects yet."
        columns={[
          {
            key: "from",
            header: "Old path",
            cell: (row) => <code className="text-[12.5px] break-all">{row.from_path}</code>,
          },
          {
            key: "to",
            header: "New path",
            cell: (row) => <code className="text-[12.5px] break-all">{row.to_path}</code>,
          },
          {
            key: "kind",
            header: "Type",
            cell: (row) => (row.permanent ? "permanent" : "temporary"),
            wide: true,
          },
          {
            key: "created",
            header: "Added",
            cell: (row) => dateFormat.format(new Date(row.created_at)),
            wide: true,
          },
          ...(canDelete
            ? [
                {
                  key: "actions",
                  header: "Actions",
                  cell: (row: (typeof rows)[number]) => (
                    <DeleteRedirect id={row.id} from={row.from_path} />
                  ),
                  end: true,
                },
              ]
            : []),
        ]}
      />
    </>
  );
}
