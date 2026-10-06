import Link from "@/components/i18n/Link";
import ContentRail from "@/components/ContentRail";
import MapFocus from "@/components/map/MapFocus";
import { SectionLabel } from "@/components/atlas/ui";
import type { Atlas } from "@/features/geography/types";
import { getT } from "@/features/i18n/request";
import { PHOTO_WIDTH, photoSrcSet, photoUrl } from "@/lib/images";
import { safeUrl } from "@/lib/security/urls";
import type { EntrySummary } from "../queries";

/**
 * Shared frame for news items and encyclopedia entries: a map focused on the region,
 * a panel with the cover photo, category, title and lead. What goes below is
 * supplied by the specific article type (`children`).
 */
export function ArticleFrame({
  item,
  atlas,
  banner,
  heroCaption,
  lang,
  children,
}: {
  item: EntrySummary;
  atlas: Atlas;
  /** Bar above the article (preview: status and link validity). */
  banner?: React.ReactNode;
  /** Cover photo credit (entries show it per the brief). */
  heroCaption?: string;
  /** Text language when it differs from the page (original without translation) — for screen readers. */
  lang?: string;
  children: React.ReactNode;
}) {
  const region = item.region ? atlas.regionBySlug.get(item.region) : undefined;
  const hero = safeUrl(item.hero);

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
        {banner}
        <article lang={lang}>
          {hero ? (
            <figure className="m-0">
              {/* A real <img>: image search indexes it and the browser finds the LCP early. */}
              {/* eslint-disable-next-line @next/next/no-img-element -- resized by /_next/image (lib/images.ts) */}
              <img
                src={photoUrl(hero, 1200)}
                srcSet={photoSrcSet(hero, [PHOTO_WIDTH.card, 1200])}
                // The wide side panel (--rail-width-wide) is at most 46 rem.
                sizes="(min-width: 768px) 46rem, 100vw"
                alt={item.title}
                width={1200}
                height={416}
                fetchPriority="high"
                decoding="async"
                className="h-52 w-full object-cover"
              />
              {heroCaption ? (
                <figcaption className="px-6 pt-2 text-right text-[10.5px] text-[var(--color-ink-muted)] sm:px-10">
                  {heroCaption}
                </figcaption>
              ) : null}
            </figure>
          ) : null}

          <div className="px-6 pt-7 pb-12 sm:px-10">
            <SectionLabel>{getT().categories[item.category]}</SectionLabel>

            <h1 className="font-display mt-4 text-[30px] leading-tight font-bold text-[var(--color-ink)]">
              {item.title}
            </h1>

            <p className="mt-3 text-[14px] leading-relaxed text-[var(--color-ink-soft)]">
              {item.summary}
            </p>

            {children}
          </div>
        </article>
      </ContentRail>
    </>
  );
}

/** The article's region and global issue as links in the details row. */
export function PlaceLinks({ item, atlas }: { item: EntrySummary; atlas: Atlas }) {
  const region = item.region ? atlas.regionBySlug.get(item.region) : undefined;
  const issue = item.issue ? atlas.issueBySlug.get(item.issue) : undefined;
  return (
    <>
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
    </>
  );
}

/** Row of small details below the lead. */
export const META_LINE =
  "mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[var(--color-ink-muted)]";
