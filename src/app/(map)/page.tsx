import type { Metadata } from "next";
import MapFocus from "@/components/map/MapFocus";
import { REGIONS } from "@/data/regions";
import { indexableCountries } from "@/lib/countries";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Atlas of Today's World — an interactive encyclopedia on a 3D globe",
  description:
    "Spin the satellite globe, click any country and read its profile: human development, political regime, living conditions and the entries behind them.",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  const countries = indexableCountries();

  // Strukturovaná data, aby vyhledávače pochopily, že mapa je rozcestník
  // na profily regionů a zemí.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Atlas of Today's World",
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
    hasPart: REGIONS.map((region) => ({
      "@type": "WebPage",
      name: region.name,
      url: `${SITE_URL}/region/${region.slug}`,
    })),
  };

  return (
    <>
      <MapFocus center={[18, 28]} zoom={1.7} />

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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
