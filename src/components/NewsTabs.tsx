"use client";

import { useState } from "react";
import Link from "next/link";
import { NEWS_CATEGORIES, type NewsCategory } from "@/lib/content-types";

export interface NewsCard {
  slug: string;
  title: string;
  summary: string;
  category: NewsCategory;
  hero?: string;
}

/** Sekce "Our News" – tmavý pruh se záložkami kategorií a řadou karet. */
export default function NewsTabs({ newsItems }: { newsItems: NewsCard[] }) {
  const available = NEWS_CATEGORIES.filter((category) =>
    newsItems.some((item) => item.category === category),
  );
  const [active, setActive] = useState<NewsCategory | null>(available[0] ?? null);

  const visible = active ? newsItems.filter((item) => item.category === active) : newsItems;

  return (
    <section className="bg-[var(--color-band)] px-6 py-9 text-white sm:px-8">
      <h2 className="font-display text-[24px] font-bold">Our News</h2>

      {available.length ? (
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[13px]">
          {available.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setActive(category)}
              className={`transition ${
                active === category
                  ? "font-semibold text-[#7f97ff]"
                  : "text-white/65 hover:text-white"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      ) : null}

      {visible.length ? (
        <div className="panel-scroll -mx-1 mt-5 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
          {visible.map((item) => (
            <Link
              key={item.slug}
              href={`/news/${item.slug}`}
              className="group w-56 shrink-0 snap-start overflow-hidden rounded-xl bg-white text-[var(--color-ink)] transition hover:-translate-y-0.5"
            >
              <div
                className="h-28 w-full bg-cover bg-center"
                style={{
                  backgroundImage: `url(${item.hero ?? "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&q=60"})`,
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
        </div>
      ) : (
        <p className="mt-5 text-[13px] text-white/60">
          No news published in this region yet. Contributors welcome.
        </p>
      )}
    </section>
  );
}
