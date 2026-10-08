import type { Metadata } from "next";
import Link from "@/components/i18n/Link";
import { notFound } from "next/navigation";
import ContentRail from "@/components/ContentRail";
import { RankingFocus } from "@/components/map/RankingFocus";
import MapViewSetter from "@/components/map/MapViewSetter";
import { SectionLabel } from "@/components/atlas/ui";
import { getAtlas } from "@/features/geography/queries";
import { format, getMessages } from "@/features/i18n/messages";
import { getRequestLocale, getT, localeFrom } from "@/features/i18n/request";
import { formatValue } from "@/lib/indicators";
import { pageMetadata, pageTitle } from "@/lib/seo/metadata";
import { breadcrumbNode, datasetNode, graph, pageUrl, webPageNode } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { routes } from "@/config/routes";

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
  return pageMetadata({
    locale,
    path: routes.view(indicator.id),
    title: pageTitle(format(t.title, { label: indicator.label })),
    description,
    keywords: [
      indicator.label,
      `${indicator.label} by country`,
      `${indicator.shortLabel} map`,
      indicator.source,
    ],
  });
}

export default async function IndicatorViewPage({
  params,
}: {
  params: Promise<{ locale: string; indicator: string }>;
}) {
  const { indicator: id } = await params;
  const locale = await localeFrom(params);
  const atlas = await getAtlas(locale);
  const indicator = atlas.indicatorById.get(id);
  if (!indicator) notFound();

  const ranked = Object.entries(indicator.values)
    .flatMap(([iso3, item]) => {
      const country = atlas.countryByIso3.get(iso3);
      return country ? [{ country, ...item }] : [];
    })
    .sort((a, b) => (indicator.higherIsBetter ? b.value - a.value : a.value - b.value));

  const years = Object.values(indicator.values).map((item) => item.year);

  return (
    <>
      <RankingFocus
        places={Object.fromEntries(
          ranked.map((row) => [row.country.iso3.toLowerCase(), row.country.bbox]),
        )}
      />
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
              <li
                key={row.country.iso3}
                id={row.country.iso3.toLowerCase()}
                // The country picked from its card (#hun) is highlighted and scrolled to.
                className="relative -mx-2 flex scroll-mt-24 items-center gap-3 rounded-md px-2 target:bg-[var(--color-accent-soft)] target:font-semibold"
              >
                <span className="w-7 shrink-0 text-[11.5px] text-[var(--color-ink-muted)] tabular-nums">
                  {indicator.type === "categorical" ? "·" : index + 1}
                </span>
                {/* The whole row is the link's hit area (44 px), not just the name. */}
                <Link
                  href={routes.country(row.country.slug)}
                  className="flex min-h-(--touch-min) flex-1 items-center text-[13.5px] text-[var(--color-ink)] after:absolute after:inset-0 after:rounded-md after:content-[''] hover:text-[var(--color-accent)] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-[var(--color-accent)]"
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
                    href={routes.view(item.id)}
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
        data={graph(
          webPageNode({
            url: pageUrl(routes.view(indicator.id), locale),
            name: indicator.label,
            description: indicator.description,
            locale,
            about: `${pageUrl(routes.view(indicator.id), locale)}#dataset`,
            breadcrumb: breadcrumbNode(
              [
                { name: "Atlas of Today's World", path: "/" },
                { name: indicator.label, path: routes.view(indicator.id) },
              ],
              locale,
            ),
          }),
          datasetNode({
            id: indicator.id,
            name: indicator.label,
            description: `${indicator.description} ${format(getT().view.description, {
              label: indicator.label,
              count: String(indicator.countryCount),
              year: String(indicator.latestYear),
              source: indicator.source,
            })}`,
            locale,
            unit: indicator.unit,
            latestYear: indicator.latestYear,
            earliestYear: years.length ? Math.min(...years) : null,
            source: indicator.source,
            sourceUrl: indicator.sourceUrl,
          }),
        )}
      />
    </>
  );
}
