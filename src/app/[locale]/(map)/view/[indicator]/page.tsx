import type { Metadata } from "next";
import Link from "@/components/i18n/Link";
import { notFound } from "next/navigation";
import ContentRail from "@/components/ContentRail";
import MapFocus from "@/components/map/MapFocus";
import MapViewSetter from "@/components/map/MapViewSetter";
import { SectionLabel } from "@/components/atlas/ui";
import { getAtlas } from "@/features/geography/queries";
import { format, getMessages } from "@/features/i18n/messages";
import { getRequestLocale, getT, localeFrom } from "@/features/i18n/request";
import { formatValue } from "@/lib/indicators";
import { absoluteUrl, alternates, breadcrumbJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";

// true: with false, Next returns 404 after revalidateTag (an admin write) even for
// existing pages (NoFallbackError). An unknown slug ends up in notFound().
export const dynamicParams = true;

export async function generateStaticParams() {
  const { indicators } = await getAtlas();
  return indicators.map((indicator) => ({ indicator: indicator.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; indicator: string }>;
}): Promise<Metadata> {
  const { indicator: id } = await params;
  const locale = await localeFrom(params);
  const t = getMessages(locale).view;
  const indicator = (await getAtlas(locale)).indicatorById.get(id);
  if (!indicator) return {};
  const description = format(t.description, {
    label: indicator.label,
    count: String(indicator.countryCount),
    year: String(indicator.latestYear),
    source: indicator.source,
  });
  const title = format(t.title, { label: indicator.label });
  return {
    title,
    description,
    alternates: alternates(`/view/${indicator.id}`, await localeFrom(params)),
    openGraph: { title, description },
  };
}

export default async function IndicatorViewPage({
  params,
}: {
  params: Promise<{ locale: string; indicator: string }>;
}) {
  const { indicator: id } = await params;
  const atlas = await getAtlas(await localeFrom(params));
  const indicator = atlas.indicatorById.get(id);
  if (!indicator) notFound();

  const ranked = Object.entries(indicator.values)
    .flatMap(([iso3, item]) => {
      const country = atlas.countryByIso3.get(iso3);
      return country ? [{ country, ...item }] : [];
    })
    .sort((a, b) => (indicator.higherIsBetter ? b.value - a.value : a.value - b.value));

  return (
    <>
      <MapFocus center={[18, 28]} zoom={1.7} />
      <MapViewSetter view={indicator.id} />

      <ContentRail>
        <div className="px-6 pt-6 pb-10">
          <SectionLabel>{getT().map.dataLayer}</SectionLabel>
          <h1 className="font-display mt-4 text-[26px] leading-tight font-bold text-[var(--color-ink)]">
            {indicator.label}
          </h1>
          <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--color-ink-muted)]">
            {format(getT().view.meta, {
              count: String(indicator.countryCount),
              year: String(indicator.latestYear),
            })}{" "}
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
              <li key={row.country.iso3} className="flex items-center gap-3 py-2">
                <span className="w-7 shrink-0 text-[11.5px] text-[var(--color-ink-muted)] tabular-nums">
                  {indicator.type === "categorical" ? "·" : index + 1}
                </span>
                <Link
                  href={`/country/${row.country.slug}`}
                  className="flex-1 text-[13.5px] text-[var(--color-ink)] hover:text-[var(--color-accent)]"
                >
                  {row.country.name}
                </Link>
                <span className="text-[13px] font-medium text-[var(--color-ink)] tabular-nums">
                  {formatValue(indicator, row.value, getRequestLocale())}
                </span>
              </li>
            ))}
          </ol>

          <p className="mt-6 text-[11px] leading-relaxed text-[var(--color-ink-muted)]">
            {getT().view.otherLayers}{" "}
            {atlas.indicators
              .filter((item) => item.id !== indicator.id)
              .map((item, i) => (
                <span key={item.id}>
                  {i > 0 ? ", " : ""}
                  <Link
                    href={`/view/${item.id}`}
                    className="text-[var(--color-link)] hover:underline"
                  >
                    {item.shortLabel}
                  </Link>
                </span>
              ))}
          </p>
        </div>
      </ContentRail>

      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Dataset",
            name: `${indicator.label} by country`,
            description: `${indicator.label}, latest available value per country (${indicator.latestYear}). Covers ${indicator.countryCount} countries.`,
            url: absoluteUrl(`/view/${indicator.id}`),
            creator: { "@type": "Organization", name: indicator.source },
            isBasedOn: indicator.sourceUrl,
            temporalCoverage: String(indicator.latestYear ?? ""),
            // The dataset covers the whole planet – make that explicit for robots.
            spatialCoverage: { "@type": "Place", name: "World" },
            variableMeasured: {
              "@type": "PropertyValue",
              name: indicator.label,
              unitText: indicator.unit.trim() || undefined,
            },
            license: "https://creativecommons.org/licenses/by/4.0/",
            isAccessibleForFree: true,
          },
          breadcrumbJsonLd([
            { name: "Atlas of Today's World", path: "/" },
            { name: indicator.label, path: `/view/${indicator.id}` },
          ]),
        ]}
      />
    </>
  );
}
