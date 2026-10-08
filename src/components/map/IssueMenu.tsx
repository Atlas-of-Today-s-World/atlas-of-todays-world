"use client";

import { usePathname } from "next/navigation";
import Link from "@/components/i18n/Link";
import { useMessages } from "@/components/i18n/LocaleProvider";
import type { ContentStatus } from "@/features/geography/content-status";
import { StatusMark } from "@/components/portrait/ContentStatusBadge";
import { format } from "@/features/i18n/messages";
import { tileBackground } from "@/lib/tile-style";
import { PHOTO_WIDTH } from "@/lib/images";
import { cn } from "@/lib/cn";
import { openIssueSlug } from "./global-issues";

export interface IssueMenuItem {
  slug: string;
  name: string;
  /** Topics counted on the issue (the same number as its pill on the globe). */
  topics: number;
  status: ContentStatus;
  /** The issue's photo; without one, its colour on the map. */
  hero: string | null;
  fill: string;
}

/**
 * The global issues on the map, in the Global issues mode, in the place and
 * the look of "Latest subtopics" (a group of countries has no name on the
 * globe, so without this nobody would know what is there): a photo tile per
 * issue with its topic count and how far the editors are. A click opens the
 * issue's panel; the open one is outlined. On phones a lower tile.
 */
export function IssueMenu({ items }: { items: IssueMenuItem[] }) {
  const t = useMessages();
  const open = openIssueSlug(usePathname());
  if (!items.length) return null;

  const status = { ready: t.map.statusReady, preparing: t.map.statusPreparing, none: "" };
  return (
    <section
      aria-labelledby="global-issues-menu"
      className="glass pointer-events-auto w-full rounded-[var(--radius-panel)] p-2 shadow-2xl shadow-black/40 sm:w-[min(92vw,22rem)] sm:p-3"
    >
      <h2
        id="global-issues-menu"
        className="px-1 text-[10.5px] font-medium tracking-[0.12em] text-white/75 uppercase max-sm:sr-only"
      >
        {t.map.issuesMenu}
      </h2>
      <ul className="grid max-h-[min(50dvh,24rem)] [scrollbar-width:thin] grid-cols-2 gap-2 overflow-y-auto sm:mt-2">
        {items.map((item) => {
          const current = item.slug === open;
          return (
            <li key={item.slug}>
              <Link
                href={`/global-issue/${item.slug}`}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "group relative flex h-20 flex-col justify-end overflow-hidden rounded-xl bg-[var(--color-ink)] bg-cover bg-center p-2 text-white transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:outline-none sm:h-24 sm:p-2.5",
                  current && "ring-2 ring-white",
                )}
                style={tileBackground(item.hero, item.fill, PHOTO_WIDTH.thumb)}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/5 transition group-hover:from-black/95"
                />
                <span className="relative flex items-center gap-1 text-[9.5px] font-medium tracking-[0.08em] text-white/75 uppercase">
                  {item.topics === 1
                    ? t.map.topicsOne
                    : format(t.map.topicsCount, { count: String(item.topics) })}
                  <StatusMark status={item.status} />
                  {status[item.status] ? (
                    <span className="sr-only">({status[item.status]})</span>
                  ) : null}
                </span>
                <span className="font-display relative mt-0.5 line-clamp-2 text-[12px] leading-tight font-semibold sm:text-[12.5px]">
                  {item.name}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
