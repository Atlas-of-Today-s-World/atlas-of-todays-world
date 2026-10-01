"use client";

import { useState } from "react";
import Link from "@/components/i18n/Link";
import { Rail } from "@/components/atlas/Rail";
import { NEWS_CATEGORIES, type NewsCategory } from "@/lib/content-types";
import { cssBackgroundImage } from "@/lib/security/urls";
import { useMessages } from "@/components/i18n/LocaleProvider";

const FALLBACK_HERO = "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&q=60";

export interface NewsCard {
  slug: string;
  title: string;
  summary: string;
  category: NewsCategory;
  hero?: string;
}

/** "Our News" section – a dark strip with category tabs and a row of cards. */
export default function NewsTabs({ newsItems }: { newsItems: NewsCard[] }) {
  const t = useMessages();
  const available = NEWS_CATEGORIES.filter((category) =>
    newsItems.some((item) => item.category === category),
  );
  const [active, setActive] = useState<NewsCategory | null>(available[0] ?? null);

  const visible = active ? newsItems.filter((item) => item.category === active) : newsItems;

  return (
    <section className="bg-[var(--color-band)] px-6 py-9 text-white sm:px-8">
      <h2 className="font-display text-[24px] font-bold">{t.newsTabs.heading}</h2>

      {available.length ? (
        <div className="mt-4 flex flex-wrap gap-x-5 text-[13px]" aria-label={t.newsTabs.categories}>
          {available.map((category) => (
            <button
              key={category}
              type="button"
              aria-pressed={active === category}
              onClick={() => setActive(category)}
              className={`min-h-11 transition ${
                active === category
                  ? "font-semibold text-[#7f97ff]"
                  : "text-white/65 hover:text-white"
              }`}
            >
              {t.categories[category]}
            </button>
          ))}
        </div>
      ) : null}

      {visible.length ? (
        <Rail label={t.portrait.news} tone="dark">
          {visible.map((item) => (
            <Link
              key={item.slug}
              href={`/news/${item.slug}`}
              className="group w-56 shrink-0 snap-start overflow-hidden rounded-xl bg-white text-[var(--color-ink)] transition hover:-translate-y-0.5"
            >
              <div
                className="h-28 w-full bg-cover bg-center"
                style={{
                  backgroundImage:
                    cssBackgroundImage(item.hero) ?? cssBackgroundImage(FALLBACK_HERO),
                }}
              />
              <div className="p-3">
                <h3 className="font-display text-[13.5px] leading-snug font-bold group-hover:text-[var(--color-accent)]">
                  {item.title}
                </h3>
                <p className="mt-1 line-clamp-3 text-[11.5px] leading-snug text-[var(--color-ink-muted)]">
                  {item.summary}
                </p>
              </div>
            </Link>
          ))}
        </Rail>
      ) : (
        <p className="mt-5 text-[13px] text-white/60">{t.newsTabs.empty}</p>
      )}
    </section>
  );
}
