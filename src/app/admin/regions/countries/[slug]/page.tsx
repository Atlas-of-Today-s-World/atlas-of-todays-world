import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NoAccess } from "@/components/admin/NoAccess";
import { ReadOnly } from "@/components/admin/ReadOnly";
import { PageHeader } from "@/components/admin/PageHeader";
import { sectionAccess } from "@/features/auth/access";
import { getAtlas } from "@/features/geography/queries";
import { CollectionEditor } from "@/features/portraits/components/CollectionEditor";
import { savePortraitSection } from "@/features/portraits/actions";
import { CountryForm } from "@/features/portraits/components/HeaderForms";
import { countryForEdit, portraitItems, portraitRights } from "@/features/portraits/editorial";

export const metadata: Metadata = { title: "Country profile" };

export default async function CountryEditPage({ params }: { params: Promise<{ slug: string }> }) {
  const access = await sectionAccess("regions");
  if (!access) return <NoAccess />;
  const { slug } = await params;
  const country = await countryForEdit(slug);
  if (!country) notFound();
  const [atlas, items, rights] = await Promise.all([
    getAtlas(),
    portraitItems({ country: country.iso3 }, ["metrics"]),
    portraitRights(access.permissions, "country"),
  ]);

  return (
    <>
      <PageHeader
        title={country.name}
        lead={
          <>
            Editorial country profile.{" "}
            <Link href={`/country/${slug}`} className="text-[var(--color-link)] underline">
              View on site
            </Link>
          </>
        }
      />
      <ReadOnly
        readOnly={!rights.head}
        reason="The country profile is edited by roles allowed to edit regions."
      >
        <CountryForm
          country={country}
          regions={atlas.regions.map(({ slug: value, name }) => ({ slug: value, name }))}
          indicators={atlas.indicators.map(({ id, label }) => ({ id, label }))}
        />
      </ReadOnly>
      <div className="mt-12 max-w-4xl">
        <p className="mb-4 rounded-xl bg-[var(--color-accent-soft)] p-4 text-[13px] text-[var(--color-ink-soft)]">
          Values of data layers (HDI, regime, GDP…) are imported automatically. To correct one for{" "}
          {country.name}, open the layer in{" "}
          <Link href="/admin/data" className="text-[var(--color-link)] underline">
            Data layers
          </Link>{" "}
          and add a manual, sourced value. The cards below are your own indicators for this country.
        </p>
        <ReadOnly
          readOnly={!rights.metrics}
          reason="Sourced indicators are edited by roles allowed to edit regions."
        >
          <CollectionEditor
            save={savePortraitSection}
            target={{ kind: "country", slug: country.iso3 }}
            collection="metrics"
            initial={items.metrics ?? []}
          />
        </ReadOnly>
      </div>
    </>
  );
}
