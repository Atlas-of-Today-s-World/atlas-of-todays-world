import type { Metadata } from "next";
import HomeFocus from "@/components/map/HomeFocus";
import { getAtlas } from "@/features/geography/queries";
import Link from "@/components/i18n/Link";
import { getMessages } from "@/features/i18n/messages";
import { localeFrom } from "@/features/i18n/request";
import { pageMetadata } from "@/lib/seo/metadata";
import { datasetNode, graph, itemListNode, pageUrl, webPageNode } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { DonateCoin } from "@/components/membership/DonateCoin";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = await localeFrom(params);
  const t = getMessages(locale).home;
  return pageMetadata({
    locale,
    path: "/",
    // `absolute`: the title already carries the site name (no template suffix).
    title: { absolute: t.title },
    description: t.description,
    keywords: [
      "world atlas",
      "interactive globe",
      "country profiles",
      "world regions",
      "human development index map",
      "political regime map",
      "encyclopedia of the present",
    ],
  });
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await localeFrom(params);
  const t = getMessages(locale).home;
  const { countries, regions, indicators } = await getAtlas(locale);

  // ISO2 -> [lon, lat]: HomeFocus uses this to rotate the globe over the visitor's country.
  const homeCenters: Record<string, [number, number]> = {};
  for (const country of countries) {
    if (country.iso2 && country.labelLon !== null && country.labelLat !== null) {
      homeCenters[country.iso2] = [country.labelLon, country.labelLat];
    }
  }

  // The map is a hub: its page lists the regions and the data layers (Datasets).
  const url = pageUrl("/", locale);
  const jsonLd = graph(
    webPageNode({ url, name: t.title, description: t.description, locale, type: "CollectionPage" }),
    {
      ...itemListNode(
        t.regions,
        regions.map((region) => ({
          name: region.name,
          url: pageUrl(`/region/${region.slug}`, locale),
        })),
      ),
      "@id": `${url}#regions`,
    },
    indicators.map((indicator) =>
      datasetNode({
        id: indicator.id,
        name: indicator.label,
        description: indicator.description,
        locale,
        unit: indicator.unit,
        latestYear: indicator.latestYear,
        source: indicator.source,
        sourceUrl: indicator.sourceUrl,
      }),
    ),
  );

  return (
    <>
      <HomeFocus centers={homeCenters} />
      {/* Bottom right, above the map attribution; the legend sits bottom left. */}
      <DonateCoin label={t.support} className="absolute right-3 bottom-3 z-20 sm:right-5" />

      {/* Text for search engines and screen readers – visually hidden, the map is in the layout. */}
      <div id="content" tabIndex={-1} className="sr-only">
        <h1>Atlas of Today&rsquo;s World</h1>
        <p>{t.intro}</p>
        <h2>{t.regions}</h2>
        <ul>
          {regions.map((region) => (
            <li key={region.slug}>
              <Link href={`/region/${region.slug}`}>{region.name}</Link>
            </li>
          ))}
        </ul>
        <h2>{t.countries}</h2>
        <ul>
          {countries.map((country) => (
            <li key={country.iso3}>
              <Link href={`/country/${country.slug}`}>{country.name}</Link>
            </li>
          ))}
        </ul>
      </div>

      <JsonLd data={jsonLd} />
    </>
  );
}
