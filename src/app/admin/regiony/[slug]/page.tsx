import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { sectionAccess } from "@/features/auth/access";
import { CollectionEditor } from "@/features/portraits/components/CollectionEditor";
import { RegionForm } from "@/features/portraits/components/HeaderForms";
import { portraitItems, regionForEdit } from "@/features/portraits/editorial";
import { COLLECTION_NAMES } from "@/features/portraits/schema";

export const metadata: Metadata = { title: "Portrét regionu" };

export default async function RegionEditPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!(await sectionAccess("regions"))) return <NoAccess />;
  const { slug } = await params;
  const region = await regionForEdit(slug);
  if (!region) notFound();
  const items = await portraitItems({ region: slug }, COLLECTION_NAMES);

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
      <RegionForm region={region} />
      <div className="mt-12 grid max-w-4xl gap-6">
        {COLLECTION_NAMES.map((collection) => (
          <CollectionEditor
            key={collection}
            kind="region"
            slug={slug}
            collection={collection}
            initial={items[collection] ?? []}
          />
        ))}
      </div>
    </>
  );
}
