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
import { DeleteIssue } from "@/features/portraits/components/DeleteIssue";
import { issueForEdit, portraitItems, portraitRights } from "@/features/portraits/editorial";
import { COLLECTION_NAMES } from "@/features/portraits/schema";

export const metadata: Metadata = { title: "Global issue" };

export default async function IssueEditPage({ params }: { params: Promise<{ slug: string }> }) {
  const access = await sectionAccess("specials");
  if (!access) return <NoAccess />;
  const { slug } = await params;
  const issue = await issueForEdit(slug);
  if (!issue) notFound();
  const [{ countries }, items, rights] = await Promise.all([
    getPickerOptions(),
    portraitItems({ issue: slug }, COLLECTION_NAMES),
    portraitRights(access.permissions, "issue"),
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
      <ReadOnly
        readOnly={!rights.head}
        reason="Celek upravuje role s právem upravovat global issues."
      >
        <IssueForm
          issue={{
            ...issue,
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
                ? "Ukazatele se zdrojem upravuje role s právem upravovat regiony."
                : "Texty portrétu (osa, FAQ, zdroje, vizuály) upravuje redakce s právem na všechny články."
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
      </div>
    </>
  );
}
