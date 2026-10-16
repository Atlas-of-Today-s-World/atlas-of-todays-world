import {
  CountryPage,
  countryMetadata,
  countryStaticParams,
} from "@/features/geography/country-page";

// true: with false, Next returns 404 after revalidateTag (an admin write) even for
// existing pages (NoFallbackError). An unknown slug ends up in notFound().
export const dynamicParams = true;

export const generateStaticParams = countryStaticParams;

export const generateMetadata = countryMetadata;

/** A country's wide preview in the side panel ("Full page view" leads to /full-page). */
export default function CountryRailPage(props: PageProps<"/[locale]/country/[slug]">) {
  return <CountryPage params={props.params} view="rail" />;
}
