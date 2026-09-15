import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ContentRail from "@/components/ContentRail";
import MapFocus from "@/components/map/MapFocus";
import { SectionLabel } from "@/components/atlas-ui";
import { allEntries, entryBySlug } from "@/lib/content";
import { countryByIso3 } from "@/lib/countries";
import {
  absoluteUrl,
  alternates,
  breadcrumbJsonLd,
  geoCoordinates,
  geoMeta,
  jsonLdHtml,
} from "@/lib/seo";

// true, aby se heslo přidané v adminu objevilo hned, bez nového buildu.
export const dynamicParams = true;

export async function generateStaticParams() {
  const entries = await allEntries();
  return entries.map((entry) => ({ slug: entry.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const entry = await entryBySlug(slug);
  if (!entry) return {};
  return {
    title: entry.title,
    description: entry.summary,
    alternates: alternates(`/entry/${entry.slug}`),
    openGraph: {
      type: "article",
      title: `${entry.title} — Atlas of Today's World`,
      description: entry.summary,
      images: entry.hero ? [entry.hero] : undefined,
      url: absoluteUrl(`/entry/${entry.slug}`),
      publishedTime: entry.published,
      modifiedTime: entry.updated ?? entry.published,
      authors: entry.author ? [entry.author] : undefined,
      section: entry.category,
    },
    keywords: [entry.title, entry.category, entry.regionRef?.name ?? ""].filter(
      Boolean,
    ),
    other: entry.regionRef
      ? geoMeta({
          lat: entry.regionRef.center[1],
          lon: entry.regionRef.center[0],
          placename: entry.regionRef.name,
        })
      : undefined,
  };
}

export default async function EntryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const entry = await entryBySlug(slug);
  if (!entry) notFound();

  const region = entry.regionRef;
  const countriesCovered = (entry.countries ?? [])
    .map((iso3) => countryByIso3(iso3))
    .filter((country): country is NonNullable<typeof country> => country !== null);

  return (
    <>
      <MapFocus
        center={region?.center ?? null}
        zoom={region?.zoom ?? null}
        regionCountries={region?.countries ?? []}
        regionStroke={region?.stroke ?? null}
        activeIso3={entry.countries?.[0] ?? null}
      />

      <ContentRail wide closeHref={region ? `/region/${region.slug}` : "/"}>
        <article>
          {entry.hero ? (
            <div
              className="h-52 w-full bg-cover bg-center"
              style={{ backgroundImage: `url(${entry.hero})` }}
              role="img"
              aria-label={entry.title}
            />
          ) : null}

          <div className="px-6 pb-12 pt-7 sm:px-10">
            <SectionLabel>{entry.category}</SectionLabel>

            <h1 className="mt-4 font-display text-[30px] font-bold leading-tight text-[var(--color-ink)]">
              {entry.title}
            </h1>

            <p className="mt-3 text-[14px] leading-relaxed text-[var(--color-ink-soft)]">
              {entry.summary}
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
              {entry.author ? <span>By {entry.author}</span> : null}
              {entry.published ? (
                <time dateTime={entry.published}>
                  {new Date(entry.published).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </time>
              ) : null}
              {entry.readingMinutes ? <span>{entry.readingMinutes} min read</span> : null}
            </p>

            <div
              className="prose-atlas mt-7 border-t border-[var(--color-line)] pt-6"
              dangerouslySetInnerHTML={{ __html: entry.html }}
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
              headline: entry.title,
              description: entry.summary,
              image: entry.hero ? [entry.hero] : undefined,
              articleSection: entry.category,
              datePublished: entry.published,
              dateModified: entry.updated ?? entry.published,
              wordCount: entry.plain.split(/\s+/).length,
              inLanguage: "en",
              isAccessibleForFree: true,
              author: entry.author
                ? { "@type": "Person", name: entry.author }
                : { "@type": "Organization", name: "Atlas of Today's World" },
              publisher: {
                "@type": "Organization",
                name: "Atlas of Today's World",
                url: absoluteUrl("/"),
              },
              mainEntityOfPage: absoluteUrl(`/entry/${entry.slug}`),
              // Kterých míst se heslo týká – tohle roboti čtou pro geo kontext.
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
              { name: "Entries", path: "/entries" },
              ...(region ? [{ name: region.name, path: `/region/${region.slug}` }] : []),
              { name: entry.title, path: `/entry/${entry.slug}` },
            ]),
          ]),
        }}
      />
    </>
  );
}
