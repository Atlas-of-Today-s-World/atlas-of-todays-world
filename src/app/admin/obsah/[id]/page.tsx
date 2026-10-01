import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { can, sectionAccess } from "@/features/auth/access";
import { listAuthors } from "@/features/authors/editorial";
import { saveEntryResources } from "@/features/entries/actions";
import { ChaptersEditor } from "@/features/entries/components/ChaptersEditor";
import { LanguageVersions } from "@/features/entries/components/LanguageVersions";
import { DEFAULT_LOCALE, isLocale, localePath } from "@/features/i18n/config";
import { EntryForm } from "@/features/entries/components/EntryForm";
import { EntryWorkflow, RevisionList } from "@/features/entries/components/EntryWorkflow";
import { PreviewShare } from "@/features/entries/components/PreviewShare";
import { StatusBadge } from "@/features/entries/components/StatusBadge";
import { VersionDiff } from "@/features/entries/components/VersionDiff";
import {
  getEditableEntry,
  getEntryParts,
  listLanguageVersions,
  listRevisions,
  publishedVersion,
} from "@/features/entries/editorial";
import { getPickerOptions } from "@/features/geography/queries";
import { CollectionEditor } from "@/features/portraits/components/CollectionEditor";
import { uuid } from "@/lib/validation/common";
import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Úprava článku" };

export default async function EditEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ulozeno?: string; preklad?: string }>;
}) {
  const access = await sectionAccess("news");
  if (!access) return <NoAccess />;
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();

  const entry = await getEditableEntry(id);
  if (!entry) notFound();

  const supabase = await createServerClient();
  const isEntry = entry.kind === "entry";
  const [options, revisions, approve, edit, published, authors, parts, versions] =
    await Promise.all([
      getPickerOptions(),
      listRevisions(id),
      supabase.rpc("can_approve_entry", { p_entry: id }),
      // Seedované články vlastníka nemají — pak rozhoduje rozsah role (news_scope).
      supabase.rpc("can_edit_entry", { p_owner: entry.owner_id as string }),
      entry.status === "pending" ? publishedVersion(id) : Promise.resolve(null),
      listAuthors(),
      isEntry ? getEntryParts(id) : Promise.resolve(null),
      listLanguageVersions(entry),
    ]);
  const canApprove = approve.data === true;
  const canEdit = edit.data === true && (entry.status !== "published" || canApprove);
  const { ulozeno, preklad } = await searchParams;

  return (
    <>
      <PageHeader
        title={entry.title}
        lead={
          <span className="flex flex-wrap items-center gap-3">
            <StatusBadge status={entry.status} />
            {entry.status === "published" ? (
              <Link
                href={localePath(
                  isLocale(entry.locale) ? entry.locale : DEFAULT_LOCALE,
                  `/${isEntry ? "entry" : "news"}/${entry.slug}`,
                )}
                className="text-[var(--color-link)] underline"
              >
                Zobrazit na webu
              </Link>
            ) : null}
            {ulozeno ? <span role="status">Koncept vytvořen.</span> : null}
            {preklad ? (
              <span role="alert" className="text-red-700">
                Překlad se nepodařilo vytvořit (nemáte právo psát, nebo už existuje).
              </span>
            ) : null}
          </span>
        }
      />

      <div className="grid gap-10 xl:grid-cols-[1fr_20rem]">
        <div className="grid content-start gap-6">
          {published ? <VersionDiff before={published} after={entry} /> : null}
          {canEdit ? (
            <>
              <EntryForm entry={entry} authors={authors} {...options} />
              {parts ? (
                <>
                  <ChaptersEditor entryId={entry.id} initial={parts.chapters} />
                  <CollectionEditor
                    save={saveEntryResources}
                    target={{ entry_id: entry.id }}
                    collection="resources"
                    initial={parts.resources}
                  />
                </>
              ) : null}
            </>
          ) : (
            <p className="rounded-xl bg-[var(--color-line)]/30 p-4 text-[13.5px]">
              {entry.status === "published"
                ? "Zveřejněný článek upravuje jen ten, kdo ho smí i schválit. Požádejte schvalovatele, nebo ho nechte stáhnout z webu."
                : "Tento článek nemůžete upravovat."}
            </p>
          )}
        </div>
        <aside className="grid content-start gap-8">
          <section>
            <h2 className="font-display mb-3 text-[16px] font-bold">Postup</h2>
            <EntryWorkflow
              id={entry.id}
              status={entry.status}
              canApprove={canApprove}
              canDelete={canEdit && can(access.permissions, "news", "d")}
              reviewNote={entry.review_note}
              publishAt={entry.publish_at}
            />
          </section>
          <section>
            <h2 className="font-display mb-3 text-[16px] font-bold">Jazykové verze</h2>
            <LanguageVersions
              currentId={entry.id}
              versions={versions}
              canCreate={can(access.permissions, "news", "c")}
            />
          </section>
          {canEdit || canApprove ? (
            <section>
              <h2 className="font-display mb-3 text-[16px] font-bold">Náhled</h2>
              <PreviewShare entryId={entry.id} />
            </section>
          ) : null}
          <section>
            <h2 className="font-display mb-3 text-[16px] font-bold">Historie změn</h2>
            {canEdit ? (
              <RevisionList entryId={entry.id} revisions={revisions} />
            ) : (
              <p className="text-[13px] text-[var(--color-ink-muted)]">
                {revisions.length} starších verzí.
              </p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
