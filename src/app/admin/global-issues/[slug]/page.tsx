import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { can, sectionAccess } from "@/features/auth/access";
import { getPickerOptions } from "@/features/geography/queries";
import { CollectionEditor } from "@/features/portraits/components/CollectionEditor";
import { IssueForm } from "@/features/portraits/components/HeaderForms";
import { DeleteIssue } from "@/features/portraits/components/DeleteIssue";
import { issueForEdit, portraitItems } from "@/features/portraits/editorial";
import { COLLECTION_NAMES } from "@/features/portraits/schema";

export const metadata: Metadata = { title: "Global issue" };

export default async function IssueEditPage({ params }: { params: Promise<{ slug: string }> }) {
  const access = await sectionAccess("specials");
  if (!access) return <NoAccess />;
  const { slug } = await params;
  const issue = await issueForEdit(slug);
  if (!issue) notFound();
  const [{ countries }, items] = await Promise.all([
    getPickerOptions(),
    portraitItems({ issue: slug }, COLLECTION_NAMES),
  ]);

  return (
    <>
      <PageHeader
        title={issue.name}
        lead={
          <>
            Global issue.{" "}
            <Link href={`/global-issue/${slug}`} className="text-[var(--color-link)] underline">
              Zobrazit na webu
            </Link>
          </>
        }
        actions={can(access.permissions, "specials", "d") ? <DeleteIssue slug={slug} /> : null}
      />
      <IssueForm
        issue={{
          ...issue,
          center_lon: Number(issue.center_lon),
          center_lat: Number(issue.center_lat),
          zoom: Number(issue.zoom),
        }}
        countries={countries}
      />
      <div className="mt-12 grid max-w-4xl gap-6">
        {COLLECTION_NAMES.map((collection) => (
          <CollectionEditor
            key={collection}
            kind="issue"
            slug={slug}
            collection={collection}
            initial={items[collection] ?? []}
          />
        ))}
      </div>
    </>
  );
}
