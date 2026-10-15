import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NoAccess } from "@/components/admin/NoAccess";
import { ReadOnly } from "@/components/admin/ReadOnly";
import { PageHeader } from "@/components/admin/PageHeader";
import { sectionAccess } from "@/features/auth/access";
import { CollectionEditor } from "@/components/admin/CollectionEditor";
import { COLLECTION_UI } from "@/features/portraits/components/fields";
import { savePortraitSection } from "@/features/portraits/actions";
import { RegionForm } from "@/features/portraits/components/HeaderForms";
import { portraitItems, portraitRights, regionForEdit } from "@/features/portraits/editorial";
import { COLLECTION_NAMES } from "@/features/portraits/schema";
import { TimelineEditor } from "@/features/timelines/components/TimelineEditor";
import { timelineForEdit } from "@/features/timelines/editorial";
import { routes } from "@/config/routes";

export const metadata: Metadata = { title: "Region portrait" };

export default async function RegionEditPage({ params }: PageProps<"/admin/regions/[slug]">) {
  const access = await sectionAccess("regions");
  if (!access) return <NoAccess />;
  const { slug } = await params;
  const region = await regionForEdit(slug);
  if (!region) notFound();
  const [items, rights, timeline] = await Promise.all([
    portraitItems({ region: slug }, COLLECTION_NAMES),
    portraitRights(access.permissions, "region"),
    timelineForEdit("region", slug),
  ]);

  return (
    <>
      <PageHeader
        title={region.name}
        lead={
          <>
            Region portrait.{" "}
            <Link href={routes.region(slug)} className="text-[var(--color-link)] underline">
              View on site
            </Link>
          </>
        }
      />
      <ReadOnly
        readOnly={!rights.head}
        reason="The header is edited by roles allowed to edit regions."
      >
        <RegionForm region={region} />
      </ReadOnly>
      <div className="mt-12 grid max-w-4xl gap-6">
        <ReadOnly
          readOnly={!rights.text}
          reason={
            "Portrait texts (timeline, FAQ, sources, visuals) are edited by editors with rights to all articles."
          }
        >
          <TimelineEditor
            kind="region"
            ownerKey={slug}
            initial={timeline}
            lead="The region's history as a row of events on its portrait and under each of its countries — oldest first."
          />
        </ReadOnly>
        {COLLECTION_NAMES.map((collection) => (
          <ReadOnly
            key={collection}
            readOnly={collection === "metrics" ? !rights.metrics : !rights.text}
            reason={
              collection === "metrics"
                ? "Sourced indicators are edited by roles allowed to edit regions."
                : "Portrait texts (timeline, FAQ, sources, visuals) are edited by editors with rights to all articles."
            }
          >
            <CollectionEditor
              save={savePortraitSection}
              target={{ kind: "region", slug }}
              collection={collection}
              ui={COLLECTION_UI[collection]}
              initial={items[collection] ?? []}
            />
          </ReadOnly>
        ))}
      </div>
    </>
  );
}
