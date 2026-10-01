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

export const metadata: Metadata = { title: "Edit article" };

export default async function EditEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; translation?: string }>;
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
  const { saved, translation } = await searchParams;

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
                View on site
              </Link>
            ) : null}
            {saved ? <span role="status">Draft created.</span> : null}
            {translation ? (
              <span role="alert" className="text-red-700">
                Couldn&apos;t create the translation (you lack write permission, or it already
                exists).
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
                ? "A published article can only be edited by someone who may also approve it. Ask an approver, or have it unpublished."
                : "You can't edit this article."}
            </p>
          )}
        </div>
        <aside className="grid content-start gap-8">
          <section>
            <h2 className="font-display mb-3 text-[16px] font-bold">Workflow</h2>
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
            <h2 className="font-display mb-3 text-[16px] font-bold">Language versions</h2>
            <LanguageVersions
              currentId={entry.id}
              versions={versions}
              canCreate={can(access.permissions, "news", "c")}
            />
          </section>
          {canEdit || canApprove ? (
            <section>
              <h2 className="font-display mb-3 text-[16px] font-bold">Preview</h2>
              <PreviewShare entryId={entry.id} />
            </section>
          ) : null}
          <section>
            <h2 className="font-display mb-3 text-[16px] font-bold">Revision history</h2>
            {canEdit ? (
              <RevisionList entryId={entry.id} revisions={revisions} />
            ) : (
              <p className="text-[13px] text-[var(--color-ink-muted)]">
                {revisions.length} older {revisions.length === 1 ? "version" : "versions"}.
              </p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
