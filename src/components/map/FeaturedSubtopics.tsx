"use client";

import Link from "@/components/i18n/Link";
import { useMessages } from "@/components/i18n/LocaleProvider";
import { TOPICS_PATH } from "@/config/navigation";
import type { SubtopicTile } from "@/features/topics/featured";
import { cssBackgroundImage } from "@/lib/security/urls";

// Photo, else the tile colour from the admin (kept light: no icon set on the home map).
const tileStyle = (item: SubtopicTile) => {
  const photo = cssBackgroundImage(item.image);
  if (photo) return { backgroundImage: photo };
  return item.background && /^#[0-9a-f]{6}$/i.test(item.background)
    ? { backgroundColor: item.background }
    : undefined;
};

/**
 * Two subtopic tiles under the search field on the home map — the newest, or
 * the ones the editors pinned in the admin (Home page). Same width as the
 * search block; on phones the globe gets the room instead.
 */
export function FeaturedSubtopics({ items }: { items: SubtopicTile[] }) {
  const t = useMessages().map;
  if (!items.length) return null;
  return (
    <section
      aria-labelledby="featured-subtopics"
      className="glass pointer-events-auto hidden w-[min(92vw,22rem)] rounded-[var(--radius-panel)] p-3 shadow-2xl shadow-black/40 md:block"
    >
      <h2
        id="featured-subtopics"
        className="px-1 text-[10.5px] font-medium tracking-[0.12em] text-white/60 uppercase"
      >
        {t.latestSubtopics}
      </h2>
      <ul className="mt-2 grid grid-cols-2 gap-2">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`${TOPICS_PATH}/${item.topicSlug}#${item.anchor}`}
              className="group relative flex h-32 flex-col justify-end overflow-hidden rounded-xl bg-[var(--color-ink)] bg-cover bg-center p-2.5 text-white transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:outline-none"
              style={tileStyle(item)}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/5 transition group-hover:from-black/95"
              />
              <span className="relative line-clamp-1 text-[9.5px] font-medium tracking-[0.08em] text-white/70 uppercase">
                {item.topicTitle}
              </span>
              <span className="font-display relative mt-0.5 line-clamp-3 text-[12.5px] leading-tight font-semibold">
                {item.title}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
