"use client";

import { PhotoTile } from "@/components/atlas/PhotoTile";
import { useMessages } from "@/components/i18n/LocaleProvider";
import type { SubtopicTile } from "@/features/topics/featured";
import { PHOTO_WIDTH } from "@/lib/images";
import { routes } from "@/config/routes";

/**
 * Two subtopic tiles under the search field on the home map — the newest, or
 * the ones the editors pinned in the admin (Home page). Same width as the
 * search block. On phones a compact strip (low tiles, the heading only for
 * screen readers), left out on short screens where the globe needs the room.
 * A tile shows its photo, else the colour from the admin (no icon on the map).
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
            <PhotoTile
              href={routes.topic(item.topicSlug, item.anchor)}
              // A topic page is a heavy route: fetched once pointed at, not on arrival.
              prefetchOnIntent
              size="sm"
              tone="dark"
              effect="lift"
              className="h-20 sm:h-32"
              image={item.image}
              background={item.background}
              width={PHOTO_WIDTH.thumb}
              kicker={item.topicTitle}
              title={item.title}
              titleClassName="sm:line-clamp-3"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
