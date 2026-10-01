import type { Metadata } from "next";
import HomeFocus from "@/components/map/HomeFocus";
import { getAtlas } from "@/features/geography/queries";
import Link from "@/components/i18n/Link";
import { getMessages } from "@/features/i18n/messages";
import { localeFrom } from "@/features/i18n/request";
import { absoluteUrl, alternates } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const t = getMessages(await localeFrom(params)).home;
  return {
    // `absolute` bypasses the "%s — Atlas of Today's World" template from the root layout,
    // otherwise the site name would appear twice in the home page title.
    title: {
      absolute: t.title,
    },
    description: t.description,
    alternates: alternates("/", await localeFrom(params)),
    keywords: [
      "world atlas",
      "interactive globe",
      "country profiles",
      "world regions",
      "human development index map",
      "political regime map",
      "encyclopedia of the present",
    ],
  };
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

  // Structured data so search engines understand the map is a hub
  // for region and country profiles, and can offer search within Atlas.
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": absoluteUrl("/#website"),
      name: "Atlas of Today's World",
      alternateName: "Atlas",
      url: absoluteUrl("/"),
      inLanguage: "en",
      publisher: { "@id": absoluteUrl("/#organization") },
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: absoluteUrl("/search?q={search_term_string}"),
        },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": absoluteUrl("/#organization"),
      name: "Atlas of Today's World",
      url: absoluteUrl("/"),
      logo: absoluteUrl("/icon.svg"),
      description:
        "An independent encyclopedia of the present, built around an interactive 3D globe.",
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "World regions of the Atlas",
      numberOfItems: regions.length,
      itemListElement: regions.map((region, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: region.name,
        url: absoluteUrl(`/region/${region.slug}`),
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: "Country indicators of Atlas of Today's World",
      description: `Latest available values of ${indicators.length} development, governance and environment indicators for the countries of the world.`,
      url: absoluteUrl("/"),
      isAccessibleForFree: true,
      spatialCoverage: { "@type": "Place", name: "World" },
      variableMeasured: indicators.map((indicator) => ({
        "@type": "PropertyValue",
        name: indicator.label,
        url: absoluteUrl(`/view/${indicator.id}`),
      })),
    },
  ];

  return (
    <>
      <HomeFocus centers={homeCenters} />

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
