import Link from "next/link";
import ContentRail from "@/components/ContentRail";
import MapFocus from "@/components/map/MapFocus";
import { SectionLabel } from "@/components/atlas/ui";
import { SafeHtml } from "@/components/atlas/SafeHtml";
import type { Atlas } from "@/features/geography/types";
import { cssBackgroundImage } from "@/lib/security/urls";
import type { Entry } from "../queries";

/**
 * Novinka tak, jak ji vidí čtenář (mapa zaostřená na region + článek).
 * Jediná podoba pro veřejnou stránku i náhled nezveřejněného článku.
 */
export function NewsArticle({
  item,
  atlas,
  banner,
}: {
  item: Entry;
  atlas: Atlas;
  /** Pruh nad článkem (náhled: stav a platnost odkazu). */
  banner?: React.ReactNode;
}) {
  const region = item.region ? atlas.regionBySlug.get(item.region) : undefined;
  const issue = item.issue ? atlas.issueBySlug.get(item.issue) : undefined;

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
    </>
  );
}
