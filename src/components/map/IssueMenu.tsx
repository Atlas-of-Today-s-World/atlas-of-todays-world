"use client";

import { usePathname } from "next/navigation";
import Link from "@/components/i18n/Link";
import { useMessages } from "@/components/i18n/LocaleProvider";
import type { ContentStatus } from "@/features/geography/content-status";
import { StatusMark } from "@/components/portrait/ContentStatusBadge";
import { cn } from "@/lib/cn";
import { useMapState } from "./MapContext";
import { openIssueSlug } from "./global-issues";

export interface IssueMenuItem {
  slug: string;
  name: string;
  /** Topics counted on the issue (the same number as its pill on the globe). */
  topics: number;
  status: ContentStatus;
}

/**
 * The global issues on the map, under the mode switch while the Global issues
 * mode is on — a group of countries has no name on the globe, so without this
 * list nobody would know what is there (Migration, War in Ukraine…). A click
 * opens the issue's panel; the open one is marked. On phones a strip that
 * scrolls sideways, on wider screens chips that wrap to the right.
 */
export function IssueMenu({ items }: { items: IssueMenuItem[] }) {
  const t = useMessages();
  const { mode } = useMapState();
  const open = openIssueSlug(usePathname());
  if (mode !== "issue" || !items.length) return null;

  const status = { ready: t.map.statusReady, preparing: t.map.statusPreparing, none: "" };
  return (
    <nav aria-label={t.map.issuesMenu} className="pointer-events-auto min-w-0">
      <ul className="-mx-4 flex [scrollbar-width:none] gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:max-w-[min(92vw,28rem,100%)] sm:flex-wrap sm:justify-end sm:overflow-visible sm:px-0 sm:pb-0">
        {items.map((item) => {
          const current = item.slug === open;
          return (
            <li key={item.slug} className="shrink-0">
              <Link
                href={`/global-issue/${item.slug}`}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex min-h-9 items-center gap-1.5 rounded-full py-1 pr-1.5 pl-3 text-[12.5px] whitespace-nowrap transition focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:outline-none pointer-coarse:min-h-(--touch-min)",
                  current
                    ? "bg-white font-medium text-[#0d1324] shadow-lg shadow-black/30"
                    : "glass glass-hover text-white/90",
                )}
              >
                {item.name}
                <StatusMark status={item.status} />
                {status[item.status] ? (
                  <span className="sr-only">({status[item.status]})</span>
                ) : null}
                <span
                  className={cn(
                    "min-w-6 rounded-full px-1.5 py-px text-center text-[11px] font-semibold tabular-nums",
                    current ? "bg-[#0d1324]/10" : "bg-white/15",
                  )}
                >
                  <span className="sr-only">{t.portrait.entries}: </span>
                  {item.topics}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
