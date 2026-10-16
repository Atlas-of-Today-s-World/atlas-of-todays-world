import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { can, sectionAccess } from "@/features/auth/access";
import { listAuthors } from "@/features/authors/editorial";
import { saveEntryFaq } from "@/features/entries/parts-actions";
import { ChaptersEditor } from "@/features/entries/components/ChaptersEditor";
import { LearnMoreEditor } from "@/features/entries/components/LearnMoreEditor";
import { SeoForm } from "@/features/entries/components/SeoForm";
import { TemplateTools, TopicTilesForm } from "@/features/entries/components/TopicTileForms";
import { DEFAULT_LOCALE, isLocale, localePath } from "@/lib/i18n/config";
import { EditStamp } from "@/features/entries/components/EditStamp";
import { EntryForm } from "@/features/entries/components/EntryForm";
import { EntryWorkflow, RevisionList } from "@/features/entries/components/EntryWorkflow";
import { PreviewShare } from "@/features/entries/components/PreviewShare";
import { StatusBadge } from "@/features/entries/components/StatusBadge";
import { VersionDiff } from "@/features/entries/components/VersionDiff";
import {
  entryRights,
  getEditableEntry,
  getEntryParts,
  listTemplates,
} from "@/features/entries/editorial";
import { listRevisions, publishedVersion } from "@/features/entries/revisions";
import { getCountryGroups, getPickerOptions } from "@/features/geography/queries";
import { CollectionEditor } from "@/components/admin/CollectionEditor";
import { COLLECTION_UI } from "@/features/portraits/components/fields";
import { cn } from "@/lib/cn";
import { uuid } from "@/lib/validation/common";
import { adminRoutes, routes } from "@/config/routes";
import { TimelineEditor } from "@/features/timelines/components/TimelineEditor";
import { timelineForEdit } from "@/features/timelines/editorial";
import { VisualsEditor } from "@/components/admin/VisualsEditor";
import { VISUAL_ACTIONS } from "@/features/visuals/admin";
import { topicVisualsForEdit } from "@/features/visuals/editorial";

export const metadata: Metadata = { title: "Edit topic or news" };

/** Sections of a dossier's editor, one per tab (`?tab=`). */
const TABS = [
  { key: "article", label: "Article" },
  { key: "topics", label: "Subtopics" },
  { key: "timeline", label: "Timeline" },
  { key: "visuals", label: "Maps & charts" },
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
                  ? adminRoutes.content(id)
                  : adminRoutes.content(id, { tab: tab.key })
              }
              aria-current={tab.key === current ? "page" : undefined}
              className={cn(
                "inline-flex min-h-(--touch-min) items-center border-b-2 px-3 text-[13.5px] font-medium transition",
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
}: PageProps<"/admin/content/[id]">) {
  const access = await sectionAccess("news");
  if (!access) return <NoAccess />;
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();

  const entry = await getEditableEntry(id);
  if (!entry) notFound();

  const isEntry = entry.kind === "entry";
  const [
    options,
    revisions,
    { canApprove, canEdit, canWithdraw },
    published,
    authors,
    parts,
    templates,
  ] = await Promise.all([
    getPickerOptions(),
    listRevisions(id),
    entryRights(entry),
    entry.status === "pending" ? publishedVersion(id) : Promise.resolve(null),
    listAuthors(),
    isEntry ? getEntryParts(id) : Promise.resolve(null),
    isEntry ? listTemplates() : Promise.resolve([]),
  ]);
  const { saved, tab: tabParam, visual } = await searchParams;
  const tab: Tab =
    isEntry && TABS.some((item) => item.key === tabParam) ? (tabParam as Tab) : "article";
  const [timeline, visuals, mapGroups] = await Promise.all([
    isEntry && tab === "timeline" ? timelineForEdit("topic", id) : null,
    isEntry && tab === "visuals" ? topicVisualsForEdit(id) : null,
    isEntry && tab === "visuals" ? getCountryGroups() : undefined,
  ]);
  const visualsHref = (visualId: string | null) =>
    adminRoutes.content(id, visualId ? { tab: "visuals", visual: visualId } : { tab: "visuals" });

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
                  routes.article(entry.kind, entry.slug),
                )}
                className="text-[var(--color-link)] underline"
              >
                View on site
              </Link>
            ) : null}
            {saved ? <span role="status">Draft created.</span> : null}
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
              {timeline ? (
                <TimelineEditor
                  kind="topic"
                  ownerKey={entry.id}
                  initial={timeline}
                  lead="The topic's history as a row of events right after its introduction — oldest first. Without events nothing is shown."
                />
              ) : null}
              {visuals ? (
                <>
                  <VisualsEditor
                    owner={{ kind: "entry", key: entry.id }}
                    visuals={visuals.topic}
                    actions={VISUAL_ACTIONS}
                    pageHref={visualsHref}
                    mapGroups={mapGroups}
                    editing={typeof visual === "string" ? visual : undefined}
                    canEdit
                    title="Maps & charts of the topic"
                    lead="A carousel after the topic's introduction and timeline, before its subtopics — one chart or map at a time, in this order. Paste a chart's embed code or link from Datawrapper, Flourish, Our World in Data or the World Bank data site."
                  />
                  {visuals.chapters.map((chapter, index) => (
                    <VisualsEditor
                      key={chapter.id}
                      owner={{ kind: "chapter", key: chapter.id }}
                      visuals={chapter.visuals}
                      actions={VISUAL_ACTIONS}
                      pageHref={visualsHref}
                      mapGroups={mapGroups}
                      editing={typeof visual === "string" ? visual : undefined}
                      canEdit
                      title={`Subtopic ${index + 1}: ${chapter.title}`}
                      lead="Shown at the end of this subtopic when it is opened."
                    />
                  ))}
                  {!visuals.chapters.length ? (
                    <p className="text-[13px] text-[var(--color-ink-muted)]">
                      Each subtopic gets its own maps & charts here once it is saved in Subtopics.
                    </p>
                  ) : null}
                </>
              ) : null}
              {parts && tab === "learn-more" ? (
                <>
                  <p className="text-[13.5px] text-[var(--color-ink-soft)]">
                    Resource tiles on the right half of the topic. Change their look and order here,
                    fill them with links and text below. Templates are managed in{" "}
                    <Link
                      href={adminRoutes.topicTemplates.list}
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
                    ui={COLLECTION_UI.faq}
                    initial={parts.faq}
                  />
                </>
              ) : null}
            </>
          ) : (
            <p className="rounded-xl bg-[var(--color-line)]/30 p-4 text-[13.5px]">
              {entry.status === "published"
                ? "A published article can only be edited by someone who may also approve it. Ask an article approver, or have it unpublished."
                : entry.status === "pending"
                  ? "This article is waiting for approval, so it can't be changed until an approver decides. To edit it again, withdraw it from review."
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
              canWithdraw={canWithdraw}
              updatedAt={entry.updated_at}
              canDelete={canEdit && can(access.permissions, "news", "d")}
              reviewNote={entry.review_note}
              publishAt={entry.publish_at}
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
