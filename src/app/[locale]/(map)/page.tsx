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
    // `absolute` obejde šablonu "%s — Atlas of Today's World" z root layoutu,
    // jinak by se název webu v titulku úvodní stránky objevil dvakrát.
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

  // ISO2 -> [lon, lat]: podle toho HomeFocus otočí globus nad zemi návštěvníka.
  const homeCenters: Record<string, [number, number]> = {};
  for (const country of countries) {
    if (country.iso2 && country.labelLon !== null && country.labelLat !== null) {
      homeCenters[country.iso2] = [country.labelLon, country.labelLat];
    }
  }

  // Strukturovaná data, aby vyhledávače pochopily, že mapa je rozcestník
  // na profily regionů a zemí, a aby uměly nabídnout vyhledávání v Atlasu.
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

      {/* Text pro vyhledávače a čtečky – vizuálně skrytý, mapa je v layoutu. */}
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
