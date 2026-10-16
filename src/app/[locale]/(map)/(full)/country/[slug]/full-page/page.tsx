import { CountryPage, countryMetadata } from "@/features/geography/country-page";

export const dynamicParams = true;

// Not prebuilt: the preview (/country/<slug>) already prerenders every country;
// the full view renders on its first visit and is cached from then on.
export const generateStaticParams = () => [];

export const generateMetadata = countryMetadata;

/** A country's page full width, the globe in its corner window (the panel's "Full page view"). */
export default function CountryFullPage(props: PageProps<"/[locale]/country/[slug]/full-page">) {
  return <CountryPage params={props.params} view="full" />;
}
