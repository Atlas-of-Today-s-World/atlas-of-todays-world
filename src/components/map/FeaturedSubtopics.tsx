"use client";

import Link from "@/components/i18n/Link";
import { useMessages } from "@/components/i18n/LocaleProvider";
import type { SubtopicTile } from "@/features/topics/featured";
import { tileBackground } from "@/lib/tile-style";
import { PHOTO_WIDTH } from "@/lib/images";
import { routes } from "@/config/routes";

// Photo, else the tile colour from the admin (kept light: no icon set on the home map).
const tileStyle = (item: SubtopicTile) =>
  tileBackground(item.image, item.background, PHOTO_WIDTH.thumb);

/**
 * Two subtopic tiles under the search field on the home map — the newest, or
 * the ones the editors pinned in the admin (Home page). Same width as the
 * search block. On phones a compact strip (low tiles, the heading only for
 * screen readers), left out on short screens where the globe needs the room.
 */
export function FeaturedSubtopics({ items }: { items: SubtopicTile[] }) {
  const t = useMessages().map;
  if (!items.length) return null;
  return (
    <section
      aria-labelledby="featured-subtopics"
      className="glass pointer-events-auto w-full rounded-[var(--radius-panel)] p-2 shadow-2xl shadow-black/40 sm:w-[min(92vw,22rem)] sm:p-3 max-sm:[@media(max-height:699px)]:hidden"
    >
      <h2
        id="featured-subtopics"
        className="px-1 text-[10.5px] font-medium tracking-[0.12em] text-white/75 uppercase max-sm:sr-only"
      >
        {t.latestSubtopics}
      </h2>
      <ul className="grid grid-cols-2 gap-2 sm:mt-2">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={routes.topic(item.topicSlug, item.anchor)}
              // A topic page is a heavy route: fetched once pointed at, not on arrival.
              prefetchOnIntent
              className="group relative flex h-20 flex-col justify-end overflow-hidden rounded-xl bg-[var(--color-ink)] bg-cover bg-center p-2 text-white transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:outline-none sm:h-32 sm:p-2.5"
              style={tileStyle(item)}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/5 transition group-hover:from-black/95"
              />
              <span className="relative line-clamp-1 text-[9.5px] font-medium tracking-[0.08em] text-white/70 uppercase">
                {item.topicTitle}
              </span>
              <span className="font-display relative mt-0.5 line-clamp-2 text-[12px] leading-tight font-semibold sm:line-clamp-3 sm:text-[12.5px]">
                {item.title}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
