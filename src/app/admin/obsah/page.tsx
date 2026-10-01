import type { Metadata } from "next";
import Link from "next/link";
import { DataTable } from "@/components/admin/DataTable";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { can, sectionAccess } from "@/features/auth/access";
import { StatusBadge } from "@/features/entries/components/StatusBadge";
import { listEntries, type EditorialRow } from "@/features/entries/editorial";
import { ENTRY_STATUSES, STATUS_LABEL, type EntryStatus } from "@/features/entries/schema";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Novinky a hesla" };

const dateFormat = new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium" });

export default async function EntriesPage({
  searchParams,
}: {
  searchParams: Promise<{ stav?: string; q?: string; moje?: string }>;
}) {
  const access = await sectionAccess("news");
  if (!access) return <NoAccess />;
  const params = await searchParams;
  const status = ENTRY_STATUSES.includes(params.stav as EntryStatus)
    ? (params.stav as EntryStatus)
    : undefined;
  const mine = params.moje === "1";
  const rows = await listEntries({ status, q: params.q, mine, userId: access.userId });

  const filterHref = (next: { stav?: string; moje?: boolean }) => {
    const search = new URLSearchParams();
    if (next.stav) search.set("stav", next.stav);
    if (next.moje ?? mine) search.set("moje", "1");
    if (params.q) search.set("q", params.q);
    const query = search.toString();
    return query ? `/admin/obsah?${query}` : "/admin/obsah";
  };

  return (
    <>
      <PageHeader
        title="Novinky a hesla"
        lead="Koncepty, články čekající na schválení a zveřejněný obsah. Zveřejnit jde jen přes schválení."
        actions={
          can(access.permissions, "news", "c") ? (
            <Link href="/admin/obsah/novy" className={buttonVariants()}>
              Nový článek
            </Link>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {[undefined, ...ENTRY_STATUSES].map((value) => (
          <Link
            key={value ?? "all"}
            href={filterHref({ stav: value })}
            aria-current={status === value ? "page" : undefined}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              status === value && "border-[var(--color-accent)] text-[var(--color-accent)]",
            )}
          >
            {value ? STATUS_LABEL[value] : "Vše"}
          </Link>
        ))}
        <Link
          href={filterHref({ stav: status, moje: !mine })}
          aria-pressed={mine}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            mine && "font-semibold text-[var(--color-accent)]",
          )}
        >
          {mine ? "✓ Jen moje" : "Jen moje"}
        </Link>
        <form className="ml-auto flex gap-2" action="/admin/obsah">
          {status ? <input type="hidden" name="stav" value={status} /> : null}
          {mine ? <input type="hidden" name="moje" value="1" /> : null}
          <label htmlFor="q" className="sr-only">
            Hledat v titulcích
          </label>
          <Input id="q" name="q" type="search" placeholder="Hledat…" defaultValue={params.q} />
        </form>
      </div>

      <DataTable<EditorialRow>
        caption="Články"
        rows={rows}
        rowKey={(row) => row.id}
        empty="Žádný článek neodpovídá filtru."
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
          {
            key: "locale",
            header: "Jazyk",
            // Překlad (G5.3) je vidět hned v seznamu; originál bez značky.
            cell: (row) => (
              <span className="text-[11px] font-medium uppercase">
                {row.translation_of ? row.locale : ""}
              </span>
            ),
          },
          { key: "status", header: "Stav", cell: (row) => <StatusBadge status={row.status} /> },
          { key: "category", header: "Kategorie", cell: (row) => row.category, wide: true },
          {
            key: "author",
            header: "Autor",
            cell: (row) => row.author_name ?? "—",
            wide: true,
          },
          {
            key: "updated",
            header: "Změněno",
            cell: (row) => dateFormat.format(new Date(row.updated_at)),
            end: true,
          },
        ]}
      />
    </>
  );
}
