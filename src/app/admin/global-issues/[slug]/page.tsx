import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NoAccess } from "@/components/admin/NoAccess";
import { ReadOnly } from "@/components/admin/ReadOnly";
import { PageHeader } from "@/components/admin/PageHeader";
import { can, sectionAccess } from "@/features/auth/access";
import { getPickerOptions } from "@/features/geography/queries";
import { CollectionEditor } from "@/features/portraits/components/CollectionEditor";
import { savePortraitSection } from "@/features/portraits/actions";
import { IssueForm } from "@/features/portraits/components/HeaderForms";
import { GROUP_KIND_LABEL } from "@/features/portraits/constants";
import { GroupArticles } from "@/features/entries/components/GroupArticles";
import { listGroupArticles } from "@/features/entries/editorial";
import { DeleteIssue } from "@/features/portraits/components/DeleteIssue";
import { issueForEdit, portraitItems, portraitRights } from "@/features/portraits/editorial";
import { COLLECTION_NAMES } from "@/features/portraits/schema";
import { contentStatus } from "@/features/geography/content-status";
import { routes } from "@/config/routes";

export const metadata: Metadata = { title: "Global issue" };

export default async function IssueEditPage({ params }: { params: Promise<{ slug: string }> }) {
  const access = await sectionAccess("specials");
  if (!access) return <NoAccess />;
  const { slug } = await params;
  const issue = await issueForEdit(slug);
  if (!issue) notFound();
  const [{ countries }, items, rights, articles] = await Promise.all([
    getPickerOptions(),
    portraitItems({ issue: slug }, COLLECTION_NAMES),
    portraitRights(access.permissions, "issue"),
    listGroupArticles(slug),
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
        />
      </ReadOnly>
      <div className="mt-12 grid max-w-4xl gap-6">
        {COLLECTION_NAMES.map((collection) => (
          <ReadOnly
            key={collection}
            readOnly={collection === "metrics" ? !rights.metrics : !rights.text}
            reason={
              collection === "metrics"
                ? "Indicators of a global issue are edited by roles allowed to edit global issues."
                : "Portrait texts (timeline, FAQ, sources, visuals) are edited by editors with rights to all articles."
            }
          >
            <CollectionEditor
              save={savePortraitSection}
              target={{ kind: "issue", slug }}
              collection={collection}
              initial={items[collection] ?? []}
            />
          </ReadOnly>
        ))}
        <GroupArticles slug={slug} members={articles.members} candidates={articles.candidates} />
      </div>
    </>
  );
}
