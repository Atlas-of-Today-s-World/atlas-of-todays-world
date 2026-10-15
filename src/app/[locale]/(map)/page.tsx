import type { Metadata } from "next";
import HomeFocus from "@/components/map/HomeFocus";
import { getAtlas } from "@/features/geography/queries";
import Link from "@/components/i18n/Link";
import { SKIP_LINK } from "@/config/layout";
import { getMessagesFor, localeFrom } from "@/features/i18n/request";
import { getSiteSettings } from "@/features/site/queries";
import { pageMetadata } from "@/lib/seo/metadata";
import { datasetNode, graph, itemListNode, pageUrl, webPageNode } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { routes } from "@/config/routes";

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const locale = await localeFrom(params);
  const t = (await getMessagesFor(locale)).home;
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

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const locale = await localeFrom(params);
  const [messages, site, { countries, regions, indicators }] = await Promise.all([
    getMessagesFor(locale),
    getSiteSettings(),
    getAtlas(locale),
  ]);
  const t = messages.home;

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
          url: pageUrl(routes.region(region.slug), locale),
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

      {/*
        Where "Skip to content" lands (the map is in the layout): the heading and intro
        for search engines and screen readers, then one link to the plain list of every
        place, hidden until a keyboard user tabs onto it.
      */}
      <div id="content" tabIndex={-1} className="outline-none">
        {/* The site's name from Admin → Site settings. */}
        <h1 className="sr-only">{site.name}</h1>
        <p className="sr-only">{t.intro}</p>
        <Link href={routes.countries} className={SKIP_LINK}>
          {t.browseAll}
        </Link>
      </div>

      <JsonLd data={jsonLd} />
    </>
  );
}
