"use client";

import { type RefObject, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useMessages } from "@/components/i18n/LocaleProvider";
import { Popover } from "@/components/ui/popover";
import { TOUCH_MIN_PX, UNDER_HEADER_BAR } from "@/config/layout";
import { format } from "@/features/i18n/messages";
import { cn } from "@/lib/cn";
import { useScrollFrame } from "@/lib/use-scroll-frame";
import type { TopicTileData } from "./DossierExplorer";

/**
 * Compact chapters bar on phones (the tiles and Previous / Next suffice on
 * wider screens): sticks under the header once the reader has scrolled past
 * the subtopic tiles (`after`), shows the open subtopic and opens a list to
 * jump to another one. It goes away again before the end of its section. The
 * sticky holder has no height, so the page below does not move.
 */
export function TopicJumpBar({
  topics,
  open,
  heading,
  after,
  onChoose,
}: {
  topics: TopicTileData[];
  /** The open panel (may be a "Learn more" tile, then no subtopic is current). */
  open: string | null;
  /** Shown when no subtopic is open: the heading of the subtopic tiles. */
  heading: string;
  /** The tiles: the bar appears once they are above it. */
  after: RefObject<HTMLElement | null>;
  onChoose: (id: string) => void;
}) {
  const t = useMessages().article;
  const holder = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useScrollFrame(holder, () => {
    const top = holder.current?.getBoundingClientRect().top;
    const tilesEnd = after.current?.getBoundingClientRect().bottom;
    const sectionEnd = holder.current?.parentElement?.getBoundingClientRect().bottom;
    if (top === undefined || tilesEnd === undefined || sectionEnd === undefined) return;
    // Until it sticks, the holder sits right below the tiles; stuck, it stays
    // put while they scroll on (1 px for rounding).
    const past = tilesEnd < top - 1;
    // The bar is one touch target tall: it goes before it would leave its section.
    const room = sectionEnd > top + TOUCH_MIN_PX;
    setShown(past && room);
  });

  const index = topics.findIndex((topic) => topic.id === open);
  const current = topics[index];

  return (
    <div ref={holder} className={cn("sticky z-30 h-0 md:hidden print:hidden", UNDER_HEADER_BAR)}>
      <nav
        aria-label={t.jumpToTopic}
        className={cn(
          "absolute -inset-x-4 top-0 grid grid-cols-[minmax(0,1fr)] border-b border-[var(--color-line)] bg-[var(--color-paper)]/95 shadow-sm backdrop-blur sm:-inset-x-8",
          !shown && "hidden",
        )}
      >
        <Popover
          label={t.jumpToTopic}
          className="max-h-[60dvh] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto"
          trigger={(props) => (
            <button
              type="button"
              {...props}
              className="flex min-h-11 w-full min-w-0 items-center gap-2 px-4 text-left text-[var(--color-ink)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-inset sm:px-8"
            >
              {current ? (
                <span className="shrink-0 text-[11px] font-semibold tracking-[0.08em] text-[var(--color-ink-muted)] uppercase">
                  {format(t.topicOf, {
                    number: String(index + 1),
                    total: String(topics.length),
                  })}
                </span>
              ) : null}
              <span className="font-display min-w-0 flex-1 truncate text-[14px] font-semibold">
                {current?.title ?? heading}
              </span>
              <ChevronDown aria-hidden className="size-4 shrink-0" />
            </button>
          )}
        >
          {(close) => (
            <ol className="grid gap-0.5">
              {topics.map((topic, position) => (
                <li key={topic.id}>
                  <button
                    type="button"
                    aria-current={topic.id === open ? "true" : undefined}
                    onClick={() => {
                      close();
                      onChoose(topic.id);
                    }}
                    className={cn(
                      "flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-[var(--color-accent-soft)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none",
                      topic.id === open && "font-semibold",
                    )}
                  >
                    <span className="w-5 shrink-0 text-[12px] text-[var(--color-ink-muted)] tabular-nums">
                      {position + 1}
                    </span>
                    <span className="min-w-0 flex-1 leading-snug">{topic.title}</span>
                    {topic.id === open ? (
                      <Check aria-hidden className="size-4 shrink-0 text-[var(--color-accent)]" />
                    ) : null}
                  </button>
                </li>
              ))}
            </ol>
          )}
        </Popover>
      </nav>
    </div>
  );
}
