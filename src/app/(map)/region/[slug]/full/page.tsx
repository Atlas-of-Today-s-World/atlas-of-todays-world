import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ContentRail from "@/components/ContentRail";
import RegionPortrait from "@/components/RegionPortrait";
import MapFocus from "@/components/map/MapFocus";
import { REGIONS, REGION_BY_SLUG } from "@/data/regions";
import { entriesOfRegion, regionDossier } from "@/lib/content";
import { alternates, breadcrumbJsonLd, jsonLdHtml } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return REGIONS.map((region) => ({ slug: region.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const region = REGION_BY_SLUG[slug];
  if (!region) return {};
  return {
    title: `${region.name} — full portrait`,
    description: region.summary.slice(0, 180),
    alternates: alternates(`/region/${region.slug}/full`),
  };
}

export default async function RegionFullPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const region = REGION_BY_SLUG[slug];
  if (!region) notFound();

  const [entries, dossier] = await Promise.all([
    entriesOfRegion(region.slug),
    regionDossier(region.slug),
  ]);

  return (
    <>
      <MapFocus
        center={region.center}
        zoom={region.zoom}
        regionCountries={region.countries}
        regionStroke={region.stroke}
      />
      <ContentRail wide closeHref={`/region/${region.slug}`}>
        <RegionPortrait region={region} entries={entries} dossier={dossier} />
      </ContentRail>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdHtml([
            // FAQ z dossieru regionu se může zobrazit přímo ve výsledcích hledání.
            ...(dossier.faq?.length
              ? [
                  {
                    "@context": "https://schema.org",
                    "@type": "FAQPage",
                    mainEntity: dossier.faq.map((item) => ({
                      "@type": "Question",
                      name: item.question,
                      acceptedAnswer: { "@type": "Answer", text: item.answer },
                    })),
                  },
                ]
              : []),
            ...(dossier.timeline?.length
              ? [
                  {
                    "@context": "https://schema.org",
                    "@type": "ItemList",
                    name: dossier.timelineTitle ?? "Historical Context of the Region",
                    itemListElement: dossier.timeline.map((item, index) => ({
                      "@type": "ListItem",
                      position: index + 1,
                      name: item.title,
                      description: item.text,
                    })),
                  },
                ]
              : []),
            breadcrumbJsonLd([
              { name: "Atlas of Today's World", path: "/" },
              { name: region.name, path: `/region/${region.slug}` },
              { name: "Full portrait", path: `/region/${region.slug}/full` },
            ]),
          ]),
        }}
      />
    </>
  );
}
