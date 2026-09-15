import type { Metadata } from "next";
import HomeFocus from "@/components/map/HomeFocus";
import { REGIONS } from "@/data/regions";
import { indexableCountries } from "@/lib/countries";
import { INDICATORS } from "@/lib/indicators";
import { absoluteUrl, alternates, jsonLdHtml } from "@/lib/seo";

export const metadata: Metadata = {
  // `absolute` obejde šablonu "%s — Atlas of Today's World" z root layoutu,
  // jinak by se název webu v titulku úvodní stránky objevil dvakrát.
  title: {
    absolute: "Atlas of Today's World — an interactive encyclopedia on a 3D globe",
  },
  description:
    "Spin the satellite globe, click any country and read its profile: human development, political regime, living conditions and the news behind them.",
  alternates: alternates("/"),
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

export default function HomePage() {
  const countries = indexableCountries();

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
      numberOfItems: REGIONS.length,
      itemListElement: REGIONS.map((region, index) => ({
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
      description: `Latest available values of ${INDICATORS.length} development, governance and environment indicators for the countries of the world.`,
      url: absoluteUrl("/"),
      isAccessibleForFree: true,
      spatialCoverage: { "@type": "Place", name: "World" },
      variableMeasured: INDICATORS.map((indicator) => ({
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
      <div className="sr-only">
        <h1>Atlas of Today&rsquo;s World</h1>
        <p>
          An interactive encyclopedia of the present. Explore the world on a 3D
          satellite globe, switch between data layers such as the Human
          Development Index, political regime or corruption perceptions, and open
          the profile of any region or country.
        </p>
        <h2>World regions</h2>
        <ul>
          {REGIONS.map((region) => (
            <li key={region.slug}>
              <a href={`/region/${region.slug}`}>{region.name}</a>
            </li>
          ))}
        </ul>
        <h2>Countries</h2>
        <ul>
          {countries.map((country) => (
            <li key={country.iso3}>
              <a href={`/country/${country.slug}`}>{country.name}</a>
            </li>
          ))}
        </ul>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }}
      />
    </>
  );
}
