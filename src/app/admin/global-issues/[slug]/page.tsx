import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NoAccess } from "@/components/admin/NoAccess";
import { ReadOnly } from "@/components/admin/ReadOnly";
import { PageHeader } from "@/components/admin/PageHeader";
import { can, sectionAccess } from "@/features/auth/access";
import { getCountryGroups, getPickerOptions } from "@/features/geography/queries";
import { CollectionEditor } from "@/components/admin/CollectionEditor";
import { COLLECTION_UI } from "@/features/portraits/components/fields";
import { savePortraitSection } from "@/features/portraits/actions";
import { IssueForm } from "@/features/portraits/components/HeaderForms";
import { GROUP_KIND_LABEL } from "@/features/portraits/constants";
import { GroupArticles } from "@/features/entries/components/GroupArticles";
import { listGroupArticles } from "@/features/entries/editorial";
import { DeleteIssue } from "@/features/portraits/components/DeleteIssue";
import { issueForEdit, portraitItems, portraitRights } from "@/features/portraits/editorial";
import { COLLECTION_NAMES } from "@/features/portraits/schema";
import { TimelineEditor } from "@/features/timelines/components/TimelineEditor";
import { timelineForEdit } from "@/features/timelines/editorial";
import { contentStatus } from "@/features/geography/content-status";
import { VisualsEditor } from "@/components/admin/VisualsEditor";
import { VISUAL_ACTIONS } from "@/features/visuals/admin";
import { visualsForEdit } from "@/features/visuals/editorial";
import { adminRoutes, routes } from "@/config/routes";

export const metadata: Metadata = { title: "Global issue" };

export default async function IssueEditPage({
  params,
  searchParams,
}: PageProps<"/admin/global-issues/[slug]">) {
  const access = await sectionAccess("specials");
  if (!access) return <NoAccess />;
  const { slug } = await params;
  const issue = await issueForEdit(slug);
  if (!issue) notFound();
  const [{ countries }, groups, items, rights, articles, timeline, visuals, { visual }] =
    await Promise.all([
      getPickerOptions(),
      getCountryGroups(slug),
      portraitItems({ issue: slug }, COLLECTION_NAMES),
      portraitRights(access.permissions, "issue"),
      listGroupArticles(slug),
      timelineForEdit("issue", slug),
      visualsForEdit("issue", slug),
      searchParams,
    ]);
  const kind = issue.kind === "region" ? "region" : "issue";

  return (
    <>
      <PageHeader
        title={issue.name}
        lead={
          <>
            {GROUP_KIND_LABEL[kind]}.{" "}
            <Link href={routes.issue(slug)} className="text-[var(--color-link)] underline">
              View on site
            </Link>
          </>
        }
        actions={
          can(access.permissions, "specials", "d") ? <DeleteIssue slug={slug} kind={kind} /> : null
        }
      />
      <ReadOnly
        readOnly={!rights.head}
        reason="Only roles allowed to edit global issues can edit this."
      >
        <IssueForm
          issue={{
            ...issue,
            kind,
            content_status: contentStatus(issue.content_status),
            center_lon: Number(issue.center_lon),
            center_lat: Number(issue.center_lat),
            zoom: Number(issue.zoom),
          }}
          countries={countries}
          groups={groups}
        />
      </ReadOnly>
      <div className="mt-12 grid max-w-4xl gap-6">
        <ReadOnly
          readOnly={!rights.text}
          reason={
            "Portrait texts (timeline, FAQ, sources) are edited by editors with rights to all articles."
          }
        >
          <TimelineEditor
            kind="issue"
            ownerKey={slug}
            initial={timeline}
            lead="The history behind it as a row of events on its portrait — oldest first."
          />
        </ReadOnly>
        <VisualsEditor
          owner={{ kind: "issue", key: slug }}
          visuals={visuals}
          actions={VISUAL_ACTIONS}
          pageHref={(id) => adminRoutes.globalIssues(slug, id ? { visual: id } : undefined)}
          editing={typeof visual === "string" ? visual : undefined}
          canEdit={rights.visuals}
          canRemove={rights.removeVisuals}
          readOnlyReason="Maps & charts are edited by roles allowed to edit global issues or editors with rights to all articles."
          lead="Interactive charts and maps on its portrait, one at a time in this order."
        />
        {COLLECTION_NAMES.map((collection) => (
          <ReadOnly
            key={collection}
            readOnly={collection === "metrics" ? !rights.metrics : !rights.text}
            reason={
              collection === "metrics"
                ? "Indicators of a global issue are edited by roles allowed to edit global issues."
                : "Portrait texts (timeline, FAQ, sources) are edited by editors with rights to all articles."
            }
          >
            <CollectionEditor
              save={savePortraitSection}
              target={{ kind: "issue", slug }}
              collection={collection}
              ui={COLLECTION_UI[collection]}
              initial={items[collection] ?? []}
            />
          </ReadOnly>
        ))}
        <GroupArticles slug={slug} members={articles.members} candidates={articles.candidates} />
      </div>
    </>
  );
}
