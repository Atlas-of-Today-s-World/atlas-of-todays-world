import Link from "next/link";
import ContentRail from "@/components/ContentRail";
import MapFocus from "@/components/map/MapFocus";
import { SectionLabel } from "@/components/atlas/ui";
import type { Atlas } from "@/features/geography/types";
import { cssBackgroundImage } from "@/lib/security/urls";
import type { EntrySummary } from "../queries";

/**
 * Společný rámec novinky i encyklopedického hesla: mapa zaostřená na region,
 * panel s titulní fotkou, kategorií, titulkem a perexem. Co je pod tím, dodá
 * konkrétní podoba článku (`children`).
 */
export function ArticleFrame({
  item,
  atlas,
  banner,
  heroCaption,
  children,
}: {
  item: EntrySummary;
  atlas: Atlas;
  /** Pruh nad článkem (náhled: stav a platnost odkazu). */
  banner?: React.ReactNode;
  /** Kredit k titulní fotce (heslo ho podle zadání ukazuje). */
  heroCaption?: string;
  children: React.ReactNode;
}) {
  const region = item.region ? atlas.regionBySlug.get(item.region) : undefined;
  const hero = cssBackgroundImage(item.hero);

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
          {hero ? (
            <figure className="m-0">
              <div
                className="h-52 w-full bg-cover bg-center"
                style={{ backgroundImage: hero }}
                role="img"
                aria-label={item.title}
              />
              {heroCaption ? (
                <figcaption className="px-6 pt-2 text-right text-[10.5px] text-[var(--color-ink-muted)] sm:px-10">
                  {heroCaption}
                </figcaption>
              ) : null}
            </figure>
          ) : null}

          <div className="px-6 pt-7 pb-12 sm:px-10">
            <SectionLabel>{item.category}</SectionLabel>

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

/** Region a global issue článku jako odkazy v řádku s údaji. */
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

/** Řádek drobných údajů pod perexem. */
export const META_LINE =
  "mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[var(--color-ink-muted)]";
