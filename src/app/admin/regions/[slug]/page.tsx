import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NoAccess } from "@/components/admin/NoAccess";
import { ReadOnly } from "@/components/admin/ReadOnly";
import { PageHeader } from "@/components/admin/PageHeader";
import { sectionAccess } from "@/features/auth/access";
import { CollectionEditor } from "@/features/portraits/components/CollectionEditor";
import { savePortraitSection } from "@/features/portraits/actions";
import { RegionForm } from "@/features/portraits/components/HeaderForms";
import { portraitItems, portraitRights, regionForEdit } from "@/features/portraits/editorial";
import { COLLECTION_NAMES } from "@/features/portraits/schema";
import { routes } from "@/config/routes";

export const metadata: Metadata = { title: "Region portrait" };

export default async function RegionEditPage({ params }: { params: Promise<{ slug: string }> }) {
  const access = await sectionAccess("regions");
  if (!access) return <NoAccess />;
  const { slug } = await params;
  const region = await regionForEdit(slug);
  if (!region) notFound();
  const [items, rights] = await Promise.all([
    portraitItems({ region: slug }, COLLECTION_NAMES),
    portraitRights(access.permissions, "region"),
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
              initial={items[collection] ?? []}
            />
          </ReadOnly>
        ))}
      </div>
    </>
  );
}
