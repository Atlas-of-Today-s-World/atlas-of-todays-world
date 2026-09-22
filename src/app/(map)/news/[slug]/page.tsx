import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ContentRail from "@/components/ContentRail";
import MapFocus from "@/components/map/MapFocus";
import { SectionLabel } from "@/components/atlas-ui";
import { allNews, newsBySlug } from "@/lib/content";
import { countryByIso3 } from "@/lib/countries";
import { globalIssueBySlug } from "@/lib/global-issues";
import {
  absoluteUrl,
  alternates,
  breadcrumbJsonLd,
  geoCoordinates,
  geoMeta,
  jsonLdHtml,
} from "@/lib/seo";

// true, aby se novinka přidaná v adminu objevila hned, bez nového buildu.
export const dynamicParams = true;

export async function generateStaticParams() {
  const newsItems = await allNews();
  return newsItems.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const item = await newsBySlug(slug);
  if (!item) return {};
  return {
    title: item.title,
    description: item.summary,
    alternates: alternates(`/news/${item.slug}`),
    openGraph: {
      type: "article",
      title: `${item.title} — Atlas of Today's World`,
      description: item.summary,
      images: item.hero ? [item.hero] : undefined,
      url: absoluteUrl(`/news/${item.slug}`),
      publishedTime: item.published,
      modifiedTime: item.updated ?? item.published,
      authors: item.author ? [item.author] : undefined,
      section: item.category,
    },
    keywords: [item.title, item.category, item.regionRef?.name ?? ""].filter(
      Boolean,
    ),
    other: item.regionRef
      ? geoMeta({
          lat: item.regionRef.center[1],
          lon: item.regionRef.center[0],
          placename: item.regionRef.name,
        })
      : undefined,
  };
}

export default async function NewsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = await newsBySlug(slug);
  if (!item) notFound();

  const region = item.regionRef;
  const issue = item.issue ? await globalIssueBySlug(item.issue) : null;
  const countriesCovered = (item.countries ?? [])
    .map((iso3) => countryByIso3(iso3))
    .filter((country): country is NonNullable<typeof country> => country !== null);

  return (
    <>
      <MapFocus
        center={region?.center ?? null}
        zoom={region?.zoom ?? null}
        regionCountries={region?.countries ?? []}
        regionStroke={region?.stroke ?? null}
        activeIso3={item.countries?.[0] ?? null}
      />

      <ContentRail wide>
        <article>
          {item.hero ? (
            <div
              className="h-52 w-full bg-cover bg-center"
              style={{ backgroundImage: `url(${item.hero})` }}
              role="img"
              aria-label={item.title}
            />
          ) : null}

          <div className="px-6 pb-12 pt-7 sm:px-10">
            <SectionLabel>{item.category}</SectionLabel>

            <h1 className="mt-4 font-display text-[30px] font-bold leading-tight text-[var(--color-ink)]">
              {item.title}
            </h1>

            <p className="mt-3 text-[14px] leading-relaxed text-[var(--color-ink-soft)]">
              {item.summary}
            </p>

            <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[var(--color-ink-muted)]">
              {region ? (
                <Link
                  href={`/region/${region.slug}`}
                  className="font-medium text-[var(--color-link)] hover:underline"
                >
                  {region.name}
                </Link>
              ) : null}
              {issue ? (
                <Link
                  href={`/global-issue/${issue.slug}`}
                  className="rounded-full border border-[var(--color-line)] px-2 py-0.5 font-medium text-[var(--color-link)] transition hover:border-[var(--color-accent)]"
                >
                  {issue.name}
                </Link>
              ) : null}
              {item.author ? <span>By {item.author}</span> : null}
              {item.published ? (
                <time dateTime={item.published}>
                  {new Date(item.published).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </time>
              ) : null}
              {item.readingMinutes ? <span>{item.readingMinutes} min read</span> : null}
            </p>

            <div
              className="prose-atlas mt-7 border-t border-[var(--color-line)] pt-6"
              dangerouslySetInnerHTML={{ __html: item.html }}
            />
          </div>
        </article>
      </ContentRail>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdHtml([
            {
              "@context": "https://schema.org",
              "@type": "Article",
              headline: item.title,
              description: item.summary,
              image: item.hero ? [item.hero] : undefined,
              articleSection: item.category,
              datePublished: item.published,
              dateModified: item.updated ?? item.published,
              wordCount: item.plain.split(/\s+/).length,
              inLanguage: "en",
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
              // Kterých míst se novinka týká – tohle roboti čtou pro geo kontext.
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
              ...(issue
                ? [{ name: issue.name, path: `/global-issue/${issue.slug}` }]
                : []),
              { name: item.title, path: `/news/${item.slug}` },
            ]),
          ]),
        }}
      />
    </>
  );
}
