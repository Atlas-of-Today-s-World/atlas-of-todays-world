import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ContentRail from "@/components/ContentRail";
import MapFocus from "@/components/map/MapFocus";
import { SectionLabel } from "@/components/atlas-ui";
import { allEntries, entryBySlug } from "@/lib/content";
import { SITE_URL } from "@/lib/site";

export const dynamicParams = false;

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
    alternates: { canonical: `/entry/${entry.slug}` },
    openGraph: {
      type: "article",
      title: `${entry.title} — Atlas of Today's World`,
      description: entry.summary,
      images: entry.hero ? [entry.hero] : undefined,
      url: `${SITE_URL}/entry/${entry.slug}`,
    },
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
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: entry.title,
            description: entry.summary,
            datePublished: entry.published,
            dateModified: entry.updated ?? entry.published,
            author: entry.author
              ? { "@type": "Person", name: entry.author }
              : { "@type": "Organization", name: "Atlas of Today's World" },
            publisher: {
              "@type": "Organization",
              name: "Atlas of Today's World",
            },
            mainEntityOfPage: `${SITE_URL}/entry/${entry.slug}`,
          }),
        }}
      />
    </>
  );
}
