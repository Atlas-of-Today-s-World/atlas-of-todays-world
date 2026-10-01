import type { Metadata } from "next";
import { EncyclopediaArticle } from "@/features/entries/components/EncyclopediaArticle";
import { NotTranslated } from "@/features/entries/components/NotTranslated";
import { getEncyclopediaEntries, getEncyclopediaEntry } from "@/features/entries/queries";
import { redirectOrNotFound } from "@/features/redirects/queries";
import { countriesOf } from "@/features/geography/model";
import { getAtlas } from "@/features/geography/queries";
import { localeFrom } from "@/features/i18n/request";
import { absoluteUrl, alternates, breadcrumbJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";

// true, so an entry published in the admin shows up immediately, without a new build.
export const dynamicParams = true;

export async function generateStaticParams() {
  const entries = await getEncyclopediaEntries();
  return entries.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const locale = await localeFrom(params);
  const item = await getEncyclopediaEntry(slug, locale);
  if (!item) return {};
  return {
    title: item.title,
    description: item.summary,
    // Without a translation /cs is a copy of the original — the canonical URL is the original's.
    alternates: alternates(`/entry/${item.slug}`, item.locale, item.languages),
    openGraph: {
      type: "article",
      title: `${item.title} — Atlas of Today's World`,
      description: item.summary,
      url: absoluteUrl(`/entry/${item.slug}`),
      publishedTime: item.published,
      modifiedTime: item.updated ?? item.published,
      authors: item.author ? [item.author] : undefined,
      section: item.category,
    },
  };
}

export default async function EntryPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { slug } = await params;
  const locale = await localeFrom(params);
  const [item, atlas] = await Promise.all([getEncyclopediaEntry(slug, locale), getAtlas(locale)]);
  // Unknown URL: redirect (changed slug), otherwise 404.
  if (!item) return redirectOrNotFound(`/entry/${slug}`, locale);

  const region = item.region ? atlas.regionBySlug.get(item.region) : undefined;
  const words = [item.html, ...item.chapters.map((chapter) => chapter.html)]
    .join(" ")
    .replace(/<[^>]+>/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;

  return (
    <>
      <EncyclopediaArticle
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
            abstract: item.summaryPoints.length ? item.summaryPoints.join(" ") : undefined,
            image: item.hero ? [item.hero] : undefined,
            articleSection: item.category,
            datePublished: item.published,
            dateModified: item.updated ?? item.published,
            wordCount: words,
            inLanguage: item.locale,
            isAccessibleForFree: true,
            author: item.author
              ? { "@type": "Person", name: item.author, description: item.authorProfile?.bio }
              : { "@type": "Organization", name: "Atlas of Today's World" },
            publisher: {
              "@type": "Organization",
              name: "Atlas of Today's World",
              url: absoluteUrl("/"),
            },
            mainEntityOfPage: absoluteUrl(`/entry/${item.slug}`),
            hasPart: item.chapters.map((chapter, index) => ({
              "@type": "WebPageElement",
              name: chapter.title,
              url: absoluteUrl(`/entry/${item.slug}#chapter-${index + 1}`),
              audio: chapter.audio
                ? { "@type": "AudioObject", contentUrl: chapter.audio, name: chapter.title }
                : undefined,
            })),
            about: countriesOf(atlas, item.countries).map((country) => ({
              "@type": "Country",
              name: country.name,
              url: absoluteUrl(`/country/${country.slug}`),
            })),
          },
          breadcrumbJsonLd([
            { name: "Atlas of Today's World", path: "/" },
            ...(region ? [{ name: region.name, path: `/region/${region.slug}` }] : []),
            { name: item.title, path: `/entry/${item.slug}` },
          ]),
        ]}
      />
    </>
  );
}
