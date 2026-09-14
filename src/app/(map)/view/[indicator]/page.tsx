import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ContentRail from "@/components/ContentRail";
import MapFocus from "@/components/map/MapFocus";
import MapViewSetter from "@/components/map/MapViewSetter";
import { SectionLabel } from "@/components/atlas-ui";
import { INDICATORS, formatValue, getIndicator } from "@/lib/indicators";
import { countryByIso3 } from "@/lib/countries";
import { SITE_URL } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return INDICATORS.map((indicator) => ({ indicator: indicator.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ indicator: string }>;
}): Promise<Metadata> {
  const { indicator: id } = await params;
  const indicator = getIndicator(id);
  if (!indicator) return {};
  const description = `${indicator.label} for ${indicator.countryCount} countries, mapped on an interactive 3D globe. Latest data: ${indicator.latestYear}. Source: ${indicator.source}.`;
  return {
    title: `${indicator.label} by country`,
    description,
    alternates: { canonical: `/view/${indicator.id}` },
    openGraph: { title: `${indicator.label} by country`, description },
  };
}

export default async function IndicatorViewPage({
  params,
}: {
  params: Promise<{ indicator: string }>;
}) {
  const { indicator: id } = await params;
  const indicator = getIndicator(id);
  if (!indicator) notFound();

  const ranked = Object.entries(indicator.values)
    .map(([iso3, entry]) => ({ country: countryByIso3(iso3), ...entry }))
    .filter((row) => row.country !== null)
    .sort((a, b) =>
      indicator.higherIsBetter ? b.value - a.value : a.value - b.value,
    );

  return (
    <>
      <MapFocus center={[18, 28]} zoom={1.7} />
      <MapViewSetter view={indicator.id} />

      <ContentRail>
        <div className="px-6 pb-10 pt-6">
          <SectionLabel>Data layer</SectionLabel>
          <h1 className="mt-4 font-display text-[26px] font-bold leading-tight text-[var(--color-ink)]">
            {indicator.label}
          </h1>
          <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--color-ink-muted)]">
            {indicator.countryCount} countries · latest data {indicator.latestYear} ·
            source{" "}
            <a
              href={indicator.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--color-link)] hover:underline"
            >
              {indicator.source}
            </a>
          </p>

          <ol className="mt-6 divide-y divide-[var(--color-line)]">
            {ranked.map((row, index) => (
              <li key={row.country!.iso3} className="flex items-center gap-3 py-2">
                <span className="w-7 shrink-0 text-[11.5px] tabular-nums text-[var(--color-ink-muted)]">
                  {indicator.type === "categorical" ? "·" : index + 1}
                </span>
                <Link
                  href={`/country/${row.country!.slug}`}
                  className="flex-1 text-[13.5px] text-[var(--color-ink)] hover:text-[var(--color-accent)]"
                >
                  {row.country!.name}
                </Link>
                <span className="text-[13px] font-medium tabular-nums text-[var(--color-ink)]">
                  {formatValue(indicator, row.value)}
                </span>
              </li>
            ))}
          </ol>

          <p className="mt-6 text-[11px] leading-relaxed text-[var(--color-ink-muted)]">
            Other layers:{" "}
            {INDICATORS.filter((item) => item.id !== indicator.id).map((item, i) => (
              <span key={item.id}>
                {i > 0 ? ", " : ""}
                <Link href={`/view/${item.id}`} className="text-[var(--color-link)] hover:underline">
                  {item.shortLabel}
                </Link>
              </span>
            ))}
          </p>
        </div>
      </ContentRail>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Dataset",
            name: `${indicator.label} by country`,
            description: `${indicator.label}, latest available value per country (${indicator.latestYear}).`,
            url: `${SITE_URL}/view/${indicator.id}`,
            creator: { "@type": "Organization", name: indicator.source },
            isBasedOn: indicator.sourceUrl,
            temporalCoverage: String(indicator.latestYear ?? ""),
          }),
        }}
      />
    </>
  );
}
