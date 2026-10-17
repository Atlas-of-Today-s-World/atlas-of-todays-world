"use client";

import { glassVariants } from "@/components/atlas/glass";
import { kickerVariants } from "@/components/atlas/kicker";
import { PhotoTile } from "@/components/atlas/PhotoTile";
import { Rail } from "@/components/atlas/Rail";
import { useMessages } from "@/components/i18n/LocaleProvider";
import type { SubtopicTile } from "@/features/topics/types";
import { cn } from "@/lib/cn";
import { PHOTO_WIDTH } from "@/lib/images";
import { routes } from "@/config/routes";

/**
 * Subtopic tiles under the search field on the home map — the ones the
 * editors pinned in the admin (Home page) first, then the newest; how many is
 * set there too (1–6). Same width as the search block: one tile fills it, two
 * sit side by side, more scroll sideways in the Atlas carousel (Rail) with the
 * next tile peeking in. On phones a compact strip (low tiles, the heading only
 * for screen readers), left out on short screens where the globe needs the
 * room. A tile shows its photo, else the colour from the admin (no icon on the map).
 */
export function FeaturedSubtopics({ items }: { items: SubtopicTile[] }) {
  const t = useMessages().map;
  if (!items.length) return null;
  const tile = (item: SubtopicTile) => (
    <PhotoTile
      href={routes.entry(item.topicSlug, item.anchor)}
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
  );
  return (
    <section
      aria-labelledby="featured-subtopics"
      className={cn(glassVariants({ kind: "panel" }), "max-sm:[@media(max-height:699px)]:hidden")}
    >
      <h2
        id="featured-subtopics"
        className={cn(kickerVariants({ tone: "glass" }), "max-sm:sr-only")}
      >
        {t.latestSubtopics}
      </h2>
      {items.length > 2 ? (
        <Rail label={t.latestSubtopics} tone="dark" gap="sm" className="mt-0 sm:mt-2">
          {items.map((item) => (
            <div key={item.id} className="w-[44%] shrink-0 snap-start">
              {tile(item)}
            </div>
          ))}
        </Rail>
      ) : (
        <ul className={cn("grid gap-2 sm:mt-2", items.length === 2 && "grid-cols-2")}>
          {items.map((item) => (
            <li key={item.id}>{tile(item)}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
