import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NoAccess } from "@/components/admin/NoAccess";
import { ReadOnly } from "@/components/admin/ReadOnly";
import { PageHeader } from "@/components/admin/PageHeader";
import { sectionAccess } from "@/features/auth/access";
import { CollectionEditor } from "@/features/portraits/components/CollectionEditor";
import { RegionForm } from "@/features/portraits/components/HeaderForms";
import { portraitItems, portraitRights, regionForEdit } from "@/features/portraits/editorial";
import { COLLECTION_NAMES } from "@/features/portraits/schema";

export const metadata: Metadata = { title: "Portrét regionu" };

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
            Portrét regionu.{" "}
            <Link href={`/region/${slug}`} className="text-[var(--color-link)] underline">
              Zobrazit na webu
            </Link>
          </>
        }
      />
      <ReadOnly readOnly={!rights.head} reason="Hlavičku upravuje role s právem upravovat regiony.">
        <RegionForm region={region} />
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
              kind="region"
              slug={slug}
              collection={collection}
              initial={items[collection] ?? []}
            />
          </ReadOnly>
        ))}
      </div>
    </>
  );
}
