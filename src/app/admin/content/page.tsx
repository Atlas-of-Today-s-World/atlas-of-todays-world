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

export const metadata: Metadata = { title: "News & entries" };

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

export default async function EntriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; mine?: string }>;
}) {
  const access = await sectionAccess("news");
  if (!access) return <NoAccess />;
  const params = await searchParams;
  const status = ENTRY_STATUSES.includes(params.status as EntryStatus)
    ? (params.status as EntryStatus)
    : undefined;
  const mine = params.mine === "1";
  const rows = await listEntries({ status, q: params.q, mine, userId: access.userId });

  const filterHref = (next: { status?: string; mine?: boolean }) => {
    const search = new URLSearchParams();
    if (next.status) search.set("status", next.status);
    if (next.mine ?? mine) search.set("mine", "1");
    if (params.q) search.set("q", params.q);
    const query = search.toString();
    return query ? `/admin/content?${query}` : "/admin/content";
  };

  return (
    <>
      <PageHeader
        title="News & entries"
        lead="Drafts, articles pending approval and published content. Publishing always goes through approval."
        actions={
          can(access.permissions, "news", "c") ? (
            <Link href="/admin/content/new" className={buttonVariants()}>
              New article
            </Link>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {[undefined, ...ENTRY_STATUSES].map((value) => (
          <Link
            key={value ?? "all"}
            href={filterHref({ status: value })}
            aria-current={status === value ? "page" : undefined}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              status === value && "border-[var(--color-accent)] text-[var(--color-accent)]",
            )}
          >
            {value ? STATUS_LABEL[value] : "All"}
          </Link>
        ))}
        <Link
          href={filterHref({ status, mine: !mine })}
          aria-pressed={mine}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            mine && "font-semibold text-[var(--color-accent)]",
          )}
        >
          {mine ? "✓ Only mine" : "Only mine"}
        </Link>
        <form className="ml-auto flex gap-2" action="/admin/content">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          {mine ? <input type="hidden" name="mine" value="1" /> : null}
          <label htmlFor="q" className="sr-only">
            Search titles
          </label>
          <Input id="q" name="q" type="search" placeholder="Search…" defaultValue={params.q} />
        </form>
      </div>

      <DataTable<EditorialRow>
        caption="Articles"
        rows={rows}
        rowKey={(row) => row.id}
        empty="No articles match the filter."
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
          {
            key: "locale",
            header: "Language",
            // Překlad (G5.3) je vidět hned v seznamu; originál bez značky.
            cell: (row) => (
              <span className="text-[11px] font-medium uppercase">
                {row.translation_of ? row.locale : ""}
              </span>
            ),
          },
          { key: "status", header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
          { key: "category", header: "Category", cell: (row) => row.category, wide: true },
          {
            key: "author",
            header: "Author",
            cell: (row) => row.author_name ?? "—",
            wide: true,
          },
          {
            key: "updated",
            header: "Updated",
            cell: (row) => dateFormat.format(new Date(row.updated_at)),
            end: true,
          },
        ]}
      />
    </>
  );
}
