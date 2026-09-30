import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { sectionAccess } from "@/features/auth/access";
import { getAtlas } from "@/features/geography/queries";
import { CollectionEditor } from "@/features/portraits/components/CollectionEditor";
import { CountryForm } from "@/features/portraits/components/HeaderForms";
import { countryForEdit, portraitItems } from "@/features/portraits/editorial";

export const metadata: Metadata = { title: "Profil země" };

export default async function CountryEditPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!(await sectionAccess("regions"))) return <NoAccess />;
  const { slug } = await params;
  const country = await countryForEdit(slug);
  if (!country) notFound();
  const [atlas, items] = await Promise.all([
    getAtlas(),
    portraitItems({ country: country.iso3 }, ["metrics"]),
  ]);

  return (
    <>
      <PageHeader
        title={country.name}
        lead={
          <>
            Redakční profil země.{" "}
            <Link href={`/country/${slug}`} className="text-[var(--color-link)] underline">
              Zobrazit na webu
            </Link>
          </>
        }
      />
      <CountryForm
        country={country}
        regions={atlas.regions.map(({ slug: value, name }) => ({ slug: value, name }))}
        indicators={atlas.indicators.map(({ id, label }) => ({ id, label }))}
      />
      <div className="mt-12 max-w-4xl">
        <CollectionEditor
          kind="country"
          slug={country.iso3}
          collection="metrics"
          initial={items.metrics ?? []}
        />
      </div>
    </>
  );
}
