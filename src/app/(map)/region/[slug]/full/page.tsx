import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ContentRail from "@/components/ContentRail";
import RegionPortrait from "@/components/RegionPortrait";
import MapFocus from "@/components/map/MapFocus";
import { REGIONS, REGION_BY_SLUG } from "@/data/regions";
import { entriesOfRegion, regionDossier } from "@/lib/content";
import { SITE_URL } from "@/lib/site";

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
    alternates: { canonical: `/region/${region.slug}/full` },
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
    </>
  );
}
