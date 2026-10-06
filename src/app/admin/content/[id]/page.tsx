import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { can, sectionAccess } from "@/features/auth/access";
import { listAuthors } from "@/features/authors/editorial";
import { saveEntryFaq } from "@/features/entries/actions";
import { ChaptersEditor } from "@/features/entries/components/ChaptersEditor";
import { LearnMoreEditor } from "@/features/entries/components/LearnMoreEditor";
import { SeoForm } from "@/features/entries/components/SeoForm";
import { TemplateTools, TopicTilesForm } from "@/features/entries/components/TopicTileForms";
import { LanguageVersions } from "@/features/entries/components/LanguageVersions";
import { DEFAULT_LOCALE, isLocale, localePath } from "@/features/i18n/config";
import { EditStamp } from "@/features/entries/components/EditStamp";
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
  listTemplates,
  publishedVersion,
} from "@/features/entries/editorial";
import { getPickerOptions } from "@/features/geography/queries";
import { CollectionEditor } from "@/features/portraits/components/CollectionEditor";
import { cn } from "@/lib/cn";
import { uuid } from "@/lib/validation/common";
import { createServerClient } from "@/lib/supabase/server";
import { articlePath } from "@/config/navigation";

export const metadata: Metadata = { title: "Edit article" };

/** Sections of a dossier's editor, one per tab (`?tab=`). */
const TABS = [
  { key: "article", label: "Article" },
  { key: "topics", label: "Subtopics" },
  { key: "learn-more", label: "Learn more" },
  { key: "seo", label: "SEO & GEO" },
] as const;
type Tab = (typeof TABS)[number]["key"];

function DossierTabs({ id, current }: { id: string; current: Tab }) {
  return (
    <nav aria-label="Topic sections" className="border-b border-[var(--color-line)]">
      <ul className="-mb-px flex flex-wrap gap-1">
        {TABS.map((tab) => (
          <li key={tab.key}>
            <Link
              href={
                tab.key === "article"
                  ? `/admin/content/${id}`
                  : `/admin/content/${id}?tab=${tab.key}`
              }
              aria-current={tab.key === current ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center border-b-2 px-3 text-[13.5px] font-medium transition",
                tab.key === current
                  ? "border-[var(--color-accent)] text-[var(--color-ink)]"
                  : "border-transparent text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]",
              )}
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default async function EditEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; translation?: string; tab?: string }>;
}) {
  const access = await sectionAccess("news");
  if (!access) return <NoAccess />;
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();

  const entry = await getEditableEntry(id);
  if (!entry) notFound();

  const supabase = await createServerClient();
  const isEntry = entry.kind === "entry";
  const [options, revisions, approve, edit, published, authors, parts, versions, templates] =
    await Promise.all([
      getPickerOptions(),
      listRevisions(id),
      supabase.rpc("can_approve_entry", { p_entry: id }),
      // Seeded articles have no owner — then the role scope decides (news_scope).
      supabase.rpc("can_edit_entry", { p_owner: entry.owner_id as string }),
      entry.status === "pending" ? publishedVersion(id) : Promise.resolve(null),
      listAuthors(),
      isEntry ? getEntryParts(id) : Promise.resolve(null),
      listLanguageVersions(entry),
      isEntry ? listTemplates() : Promise.resolve([]),
    ]);
  const canApprove = approve.data === true;
  const canEdit = edit.data === true && (entry.status !== "published" || canApprove);
  const { saved, translation, tab: tabParam } = await searchParams;
  const tab: Tab =
    isEntry && TABS.some((item) => item.key === tabParam) ? (tabParam as Tab) : "article";

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
                  articlePath(entry.kind, entry.slug),
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
          {isEntry ? <DossierTabs id={entry.id} current={tab} /> : null}
          {canEdit ? (
            <>
              {tab === "article" ? (
                <EntryForm entry={entry} authors={authors} {...options} />
              ) : null}
              {parts && tab === "topics" ? (
                <ChaptersEditor
                  entryId={entry.id}
                  initial={parts.chapters}
                  names={parts.stamps.names}
                />
              ) : null}
              {parts && tab === "learn-more" ? (
                <>
                  <p className="text-[13.5px] text-[var(--color-ink-soft)]">
                    Resource tiles on the right half of the topic. Change their look and order here,
                    fill them with links and text below. Templates are managed in{" "}
                    <Link
                      href="/admin/topic-templates"
                      className="text-[var(--color-link)] underline"
                    >
                      Topic templates
                    </Link>
                    .
                  </p>
                  <TemplateTools
                    entryId={entry.id}
                    templates={templates}
                    current={parts.labels.template_id}
                  />
                  <section
                    aria-labelledby="tiles-title"
                    className="grid gap-4 rounded-2xl border border-[var(--color-line)] p-5"
                  >
                    <h2 id="tiles-title" className="font-display text-[18px] font-bold">
                      Tiles and headings
                    </h2>
                    <TopicTilesForm entryId={entry.id} tiles={parts.tiles} labels={parts.labels} />
                  </section>
                  <section aria-labelledby="links-title" className="grid gap-4">
                    <h2 id="links-title" className="font-display text-[18px] font-bold">
                      Links and text in the tiles
                    </h2>
                    <LearnMoreEditor
                      key={parts.tiles.map((tile) => tile.id).join("|")}
                      entryId={entry.id}
                      tiles={parts.tiles}
                      links={parts.links}
                      notes={parts.notes}
                    />
                  </section>
                </>
              ) : null}
              {parts && tab === "seo" ? (
                <>
                  <SeoForm
                    entryId={entry.id}
                    seo={parts.seo}
                    defaults={{ title: entry.title, description: entry.summary }}
                  />
                  <CollectionEditor
                    save={saveEntryFaq}
                    target={{ entry_id: entry.id }}
                    collection="faq"
                    initial={parts.faq}
                  />
                </>
              ) : null}
            </>
          ) : (
            <p className="rounded-xl bg-[var(--color-line)]/30 p-4 text-[13.5px]">
              {entry.status === "published"
                ? "A published article can only be edited by someone who may also approve it. Ask an article approver, or have it unpublished."
                : "You can't edit this article."}
            </p>
          )}
        </div>
        <aside className="grid content-start gap-8">
          {parts ? (
            <section>
              <h2 className="font-display mb-2 text-[16px] font-bold">Who and when</h2>
              <EditStamp
                createdAt={parts.stamps.created_at}
                createdBy={parts.stamps.created_by}
                updatedAt={parts.stamps.updated_at}
                updatedBy={parts.stamps.updated_by}
                names={parts.stamps.names}
                className="text-[13px] leading-relaxed text-[var(--color-ink-soft)]"
              />
            </section>
          ) : null}
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
