"use client";

import { glassVariants } from "@/components/atlas/glass";
import { kickerVariants } from "@/components/atlas/kicker";
import { PhotoTile } from "@/components/atlas/PhotoTile";
import { Rail } from "@/components/atlas/Rail";
import { useMessages } from "@/components/i18n/LocaleProvider";
import type { EntryTile } from "@/features/topics/types";
import { cn } from "@/lib/cn";
import { PHOTO_WIDTH } from "@/lib/images";
import { routes } from "@/config/routes";
import { SM_MIN_PX } from "@/config/layout";

/**
 * Entry tiles under the search field on the home map — the most recently
 * published entries; how many is set in the admin (Home page, 1–6). Same width
 * as the search block: one tile fills it, two sit side by side, more scroll
 * sideways in the Atlas carousel (Rail) with the next tile peeking in. Desktop
 * only: on phones the globe needs the room. A tile shows its photo, else the
 * colour from the admin. The first tile's photo is the home page's Largest
 * Contentful Paint on a computer: loaded at once, at high priority — and not
 * at all on phones, where the section is hidden.
 */
export function LatestEntries({ items }: { items: EntryTile[] }) {
  const t = useMessages().map;
  if (!items.length) return null;
  const tile = (item: EntryTile, index: number) => (
    <PhotoTile
      href={routes.entry(item.slug)}
      // An entry page is a heavy route: fetched once pointed at, not on arrival.
      prefetchOnIntent
      size="sm"
      tone="dark"
      effect="lift"
      className="h-32"
      image={item.image}
      background={item.background}
      width={PHOTO_WIDTH.thumb}
      priority={index === 0}
      photoShownFrom={SM_MIN_PX}
      kicker={item.kicker}
      title={item.title}
      titleClassName="line-clamp-3"
    />
  );
  return (
    <section
      aria-labelledby="latest-entries"
      className={cn(glassVariants({ kind: "panel" }), "max-sm:hidden")}
    >
      <h2 id="latest-entries" className={kickerVariants({ tone: "glass" })}>
        {t.latestEntries}
      </h2>
      {items.length > 2 ? (
        <Rail label={t.latestEntries} tone="dark" gap="sm" className="mt-2">
          {items.map((item, index) => (
            <div key={item.slug} className="w-[44%] shrink-0 snap-start">
              {tile(item, index)}
            </div>
          ))}
        </Rail>
      ) : (
        <ul className={cn("mt-2 grid gap-2", items.length === 2 && "grid-cols-2")}>
          {items.map((item, index) => (
            <li key={item.slug}>{tile(item, index)}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
