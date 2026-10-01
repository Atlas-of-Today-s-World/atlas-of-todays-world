import type { Metadata } from "next";
import { NewsArticle } from "@/features/entries/components/NewsArticle";
import { NotTranslated } from "@/features/entries/components/NotTranslated";
import { redirectOrNotFound } from "@/features/redirects/queries";
import { getEntries, getEntry } from "@/features/entries/queries";
import { countriesOf } from "@/features/geography/model";
import { getAtlas } from "@/features/geography/queries";
import { localeFrom } from "@/features/i18n/request";
import { absoluteUrl, alternates, breadcrumbJsonLd, geoCoordinates, geoMeta } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";

// true, so a news item added in the admin shows up immediately, without a new build.
export const dynamicParams = true;

export async function generateStaticParams() {
  const entries = await getEntries();
  return entries.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const locale = await localeFrom(params);
  const [item, atlas] = await Promise.all([getEntry(slug, locale), getAtlas(locale)]);
  if (!item) return {};
  const region = item.region ? atlas.regionBySlug.get(item.region) : undefined;
  return {
    title: item.title,
    description: item.summary,
    // Without a translation /cs is a copy of the original — the canonical URL is the original's.
    alternates: alternates(`/news/${item.slug}`, item.locale, item.languages),
    openGraph: {
      type: "article",
      title: `${item.title} — Atlas of Today's World`,
      description: item.summary,
      url: absoluteUrl(`/news/${item.slug}`),
      publishedTime: item.published,
      modifiedTime: item.updated ?? item.published,
      authors: item.author ? [item.author] : undefined,
      section: item.category,
    },
    keywords: [item.title, item.category, region?.name ?? ""].filter(Boolean),
    other: region
      ? geoMeta({ lat: region.center[1], lon: region.center[0], placename: region.name })
      : undefined,
  };
}

export default async function NewsPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { slug } = await params;
  const locale = await localeFrom(params);
  const [item, atlas] = await Promise.all([getEntry(slug, locale), getAtlas(locale)]);
  // Unknown URL: redirect (changed slug), otherwise 404.
  if (!item) return redirectOrNotFound(`/news/${slug}`, locale);

  const region = item.region ? atlas.regionBySlug.get(item.region) : undefined;
  const issue = item.issue ? atlas.issueBySlug.get(item.issue) : undefined;
  const countriesCovered = countriesOf(atlas, item.countries);

  return (
    <>
      <NewsArticle
        item={item}
        atlas={atlas}
        banner={<NotTranslated page={locale} text={item.locale} />}
      />

      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: item.title,
            description: item.summary,
            image: item.hero ? [item.hero] : undefined,
            articleSection: item.category,
            datePublished: item.published,
            dateModified: item.updated ?? item.published,
            wordCount: item.html
              .replace(/<[^>]+>/g, " ")
              .split(/\s+/)
              .filter(Boolean).length,
            inLanguage: item.locale,
            isAccessibleForFree: true,
            author: item.author
              ? { "@type": "Person", name: item.author }
              : { "@type": "Organization", name: "Atlas of Today's World" },
            publisher: {
              "@type": "Organization",
              name: "Atlas of Today's World",
              url: absoluteUrl("/"),
            },
            mainEntityOfPage: absoluteUrl(`/news/${item.slug}`),
            // Which places the news item concerns – robots read this for geo context.
            contentLocation: region
              ? {
                  "@type": "Place",
                  name: region.name,
                  url: absoluteUrl(`/region/${region.slug}`),
                  geo: geoCoordinates(region.center[1], region.center[0]),
                }
              : undefined,
            about: countriesCovered.map((country) => ({
              "@type": "Country",
              name: country.name,
              url: absoluteUrl(`/country/${country.slug}`),
            })),
          },
          breadcrumbJsonLd([
            { name: "Atlas of Today's World", path: "/" },
            { name: "News", path: "/news" },
            ...(region ? [{ name: region.name, path: `/region/${region.slug}` }] : []),
            ...(issue ? [{ name: issue.name, path: `/global-issue/${issue.slug}` }] : []),
            { name: item.title, path: `/news/${item.slug}` },
          ]),
        ]}
      />
    </>
  );
}
