import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ContentRail from "@/components/ContentRail";
import MapFocus from "@/components/map/MapFocus";
import { SectionLabel } from "@/components/atlas/ui";
import { getEntries, getEntry } from "@/features/entries/queries";
import { countriesOf } from "@/features/geography/model";
import { getAtlas } from "@/features/geography/queries";
import { absoluteUrl, alternates, breadcrumbJsonLd, geoCoordinates, geoMeta } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { SafeHtml } from "@/components/atlas/SafeHtml";
import { cssBackgroundImage } from "@/lib/security/urls";

// true, aby se novinka přidaná v adminu objevila hned, bez nového buildu.
export const dynamicParams = true;

export async function generateStaticParams() {
  const entries = await getEntries();
  return entries.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const [item, atlas] = await Promise.all([getEntry(slug), getAtlas()]);
  if (!item) return {};
  const region = item.region ? atlas.regionBySlug.get(item.region) : undefined;
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
    keywords: [item.title, item.category, region?.name ?? ""].filter(Boolean),
    other: region
      ? geoMeta({ lat: region.center[1], lon: region.center[0], placename: region.name })
      : undefined,
  };
}

export default async function NewsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [item, atlas] = await Promise.all([getEntry(slug), getAtlas()]);
  if (!item) notFound();

  const region = item.region ? atlas.regionBySlug.get(item.region) : undefined;
  const issue = item.issue ? atlas.issueBySlug.get(item.issue) : undefined;
  const countriesCovered = countriesOf(atlas, item.countries);

  return (
    <>
      <MapFocus
        center={region?.center ?? null}
        zoom={region?.zoom ?? null}
        regionCountries={region?.countries ?? []}
        regionStroke={region?.stroke ?? null}
        activeIso3={item.countries[0] ?? null}
      />

      <ContentRail wide>
        <article>
          {cssBackgroundImage(item.hero) ? (
            <div
              className="h-52 w-full bg-cover bg-center"
              style={{ backgroundImage: cssBackgroundImage(item.hero) }}
              role="img"
              aria-label={item.title}
            />
          ) : null}

          <div className="px-6 pt-7 pb-12 sm:px-10">
            <SectionLabel>{item.category}</SectionLabel>

            <h1 className="font-display mt-4 text-[30px] leading-tight font-bold text-[var(--color-ink)]">
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

            <SafeHtml
              className="prose-atlas mt-7 border-t border-[var(--color-line)] pt-6"
              html={item.html}
            />
          </div>
        </article>
      </ContentRail>

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
            ...(issue ? [{ name: issue.name, path: `/global-issue/${issue.slug}` }] : []),
            { name: item.title, path: `/news/${item.slug}` },
          ]),
        ]}
      />
    </>
  );
}
