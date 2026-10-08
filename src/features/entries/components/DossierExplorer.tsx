"use client";

import { type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { useMessages } from "@/components/i18n/LocaleProvider";
import { format } from "@/features/i18n/messages";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { scrollBehavior } from "@/lib/motion";
import { useLatest } from "@/lib/use-latest";
import type { TileIcon as TileIconName } from "../constants";
import { tileStyle } from "./TileFace";
import { TileIcon } from "./TileIcon";
import { TopicJumpBar } from "./TopicJumpBar";

export interface TopicTileData {
  /** Panel id, also the URL hash (`topic-2`). */
  id: string;
  title: string;
  image?: string;
  /** Tile colour when there is no photo. */
  background?: string;
}

export interface LearnTileData {
  id: string;
  label: string;
  description: string;
  icon: TileIconName;
  image?: string;
  background?: string;
  count: number;
  /** Nothing in this dossier yet: shown greyed out, not clickable. */
  empty: boolean;
}

const subscribe = (onChange: () => void) => {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
};
const readHash = () => window.location.hash.slice(1);
const noHash = () => "";
/** Older links pointed at `#chapter-3`; topics took their place. */
const panelOf = (hash: string) => hash.replace(/^chapter-/, "topic-");
/** Shared look of both tile kinds: photo or dark field, gradient for legible text. */
const TILE =
  "group relative flex w-full flex-col justify-end overflow-hidden rounded-xl bg-[var(--color-ink)] bg-cover bg-center p-3.5 text-left text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2";
const SHADE =
  "pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/5 transition group-hover:from-black/90";
const ACTIVE = "ring-2 ring-[var(--color-accent)] ring-offset-2";
const HEADING = "font-display text-[26px] font-semibold tracking-tight sm:text-[30px]";
/**
 * One grid of four equal columns on wide screens: subtopics fill three, the
 * resource column the fourth. A resource tile is half a subtopic tile minus
 * half the gap, so two of them line up with one subtopic tile.
 */
const GAP = "gap-3";
const SUBTOPIC_HEIGHT = "h-30 sm:h-36";
// (144 px − 12 px gap) / 2 = 66 px from `sm` up; on phones the columns stack, no pairing needed.
const RESOURCE_HEIGHT = "h-16 sm:h-[4.125rem]";
/** Half-height resource tile: icon beside the label instead of above it. */
const RESOURCE = cn(RESOURCE_HEIGHT, "flex-row items-center justify-start gap-3 py-2");

/**
 * The topic's two halves side by side: subtopic tiles on the left, "Learn
 * more" resource tiles on the right (stacked on narrow screens). A tile opens
 * its panel below both halves; every panel is in the HTML (search engines,
 * print), only the open one is shown, mirrored in the URL hash (`#topic-2`,
 * `#learn-videos`).
 */
export function DossierExplorer({
  topics,
  tiles,
  topicPanels,
  tilePanels,
  labels = {},
}: {
  topics: TopicTileData[];
  tiles: LearnTileData[];
  topicPanels: Record<string, ReactNode>;
  tilePanels: Record<string, ReactNode>;
  /** Headings set in the topic (from its template); missing = the default texts. */
  labels?: { articles?: string; learnMore?: string };
}) {
  const t = useMessages().article;
  const hash = useSyncExternalStore(subscribe, readHash, noHash);
  const [chosen, setChosen] = useState<string | null>(null);
  const tilesRef = useRef<HTMLDivElement>(null);
  const fallback = topics[0]?.id ?? tiles.find((tile) => !tile.empty)?.id ?? null;
  const wanted = panelOf(hash);
  const open = chosen ?? (wanted in topicPanels || wanted in tilePanels ? wanted : fallback);

  const choose = (id: string, block: ScrollLogicalPosition = "nearest") => {
    // Focus inside the panel being closed (Previous / Next, a link in its text)
    // would drop to <body> once it is hidden — it moves to the new panel instead.
    const from = document.activeElement?.closest<HTMLElement>("[data-dossier-panel]");
    // Show the panel first: a hidden one can't be scrolled to, and the page would
    // stay where the previous subtopic ended (Previous / Next at its bottom).
    flushSync(() => setChosen(id));
    window.history.replaceState(null, "", `#${id}`);
    const panel = document.getElementById(id);
    panel?.scrollIntoView({ behavior: scrollBehavior(), block });
    if (panel && from && from !== panel) {
      // Its heading (`tabIndex={-1}`), so reading continues from the top.
      (panel.querySelector<HTMLElement>("h2[tabindex]") ?? panel).focus({ preventScroll: true });
    }
  };

  // A link to a panel (`#topic-3`) — shared, from the search on /topics, or in
  // the text — names a panel the server rendered hidden, so the browser had
  // nothing to scroll to: open it and bring it into view, on load and whenever
  // the hash changes later (also after a tile was chosen).
  const reveal = useLatest(() => {
    const id = panelOf(readHash());
    if (id in topicPanels || id in tilePanels) choose(id, "start");
  });
  useEffect(() => {
    const onHash = () => reveal.current();
    // After hydration has committed: the panel can then be shown and scrolled to.
    const frame = requestAnimationFrame(onHash);
    window.addEventListener("hashchange", onHash);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", onHash);
    };
  }, [reveal]);

  /** Previous / next subtopic under the open one, as tiles of the same size as above. */
  const stepper = (id: string) => {
    const index = topics.findIndex((topic) => topic.id === id);
    if (index === -1) return null;
    const steps = [
      { topic: topics[index - 1], label: t.previousTopic, back: true },
      { topic: topics[index + 1], label: t.nextTopic, back: false },
    ];
    return (
      <nav aria-label={t.topicSteps} className="mt-12 grid grid-cols-2 gap-3 print:hidden">
        {steps.map(({ topic, label, back }) =>
          topic ? (
            <button
              key={topic.id}
              type="button"
              aria-label={format(label, { title: topic.title })}
              // Open it and start reading from its top.
              onClick={() => choose(topic.id, "start")}
              className={cn(
                TILE,
                SUBTOPIC_HEIGHT,
                "w-full max-w-72",
                back ? "justify-self-start" : "items-end justify-self-end text-right",
              )}
              style={tileStyle(topic.image, topic.background)}
            >
              <span aria-hidden className={SHADE} />
              <span className="relative mb-auto inline-flex w-fit items-center gap-1.5 rounded-full bg-black/45 px-3 py-1 text-[13px] font-semibold tracking-[0.08em] uppercase backdrop-blur-sm">
                {back ? <ArrowLeft aria-hidden className="size-4" /> : null}
                {back ? t.previous : t.next}
                {back ? null : <ArrowRight aria-hidden className="size-4" />}
              </span>
              <span className="font-display relative line-clamp-3 text-[18px] leading-tight font-semibold text-balance sm:text-[19px]">
                {topic.title}
              </span>
            </button>
          ) : (
            <span key={back ? "none-back" : "none-next"} aria-hidden />
          ),
        )}
      </nav>
    );
  };

  const panels = (record: Record<string, ReactNode>) => (
    <div>
      {Object.entries(record).map(([id, panel]) => (
        <div
          key={id}
          id={id}
          data-dossier-panel
          className={cn(
            "scroll-mt-32 md:scroll-mt-24",
            open === id ? "block" : "hidden print:block",
          )}
        >
          {panel}
          {stepper(id)}
        </div>
      ))}
    </div>
  );

  return (
    <div className="mt-12">
      <div ref={tilesRef} className={cn("grid gap-y-10 lg:grid-cols-4", GAP)}>
        {topics.length ? (
          <section aria-labelledby="dossier-topics" className="lg:col-span-3">
            <h2 id="dossier-topics" className={HEADING}>
              {labels.articles ?? t.chapters}
            </h2>
            <ul className={cn("mt-5 grid grid-cols-2 sm:grid-cols-3", GAP)}>
              {topics.map((topic, index) => {
                return (
                  <li key={topic.id}>
                    <button
                      type="button"
                      aria-controls={topic.id}
                      aria-expanded={open === topic.id}
                      aria-label={format(t.showTopic, {
                        number: String(index + 1),
                        title: topic.title,
                      })}
                      onClick={() => choose(topic.id)}
                      className={cn(TILE, SUBTOPIC_HEIGHT, open === topic.id && ACTIVE)}
                      style={tileStyle(topic.image, topic.background)}
                    >
                      <span aria-hidden className={SHADE} />
                      <span className="font-display relative text-[15px] leading-tight font-semibold text-balance sm:text-[16px]">
                        {topic.title}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {tiles.length ? (
          <section aria-labelledby="dossier-learn-more">
            <h2 id="dossier-learn-more" className={HEADING}>
              {labels.learnMore ?? t.learnMore}
            </h2>
            <ul className={cn("mt-5 grid grid-cols-2 lg:grid-cols-1", GAP)}>
              {tiles.map((tile) => {
                const style = tileStyle(tile.image, tile.background);
                const body = (
                  <>
                    <span aria-hidden className={SHADE} />
                    <span className="relative grid size-9 shrink-0 place-items-center rounded-full bg-white/15 backdrop-blur-sm">
                      <TileIcon name={tile.icon} className="size-4.5" />
                    </span>
                    <span className="relative flex min-w-0 flex-col">
                      <span className="font-display line-clamp-2 text-[13.5px] leading-tight font-bold">
                        {tile.label}
                      </span>
                      <span className="mt-0.5 truncate text-[11px] text-white/70">
                        {tile.empty
                          ? t.comingSoon
                          : tile.count === 1
                            ? t.resourcesOne
                            : tile.count
                              ? format(t.resourcesCount, { count: String(tile.count) })
                              : tile.description}
                      </span>
                    </span>
                  </>
                );
                return (
                  <li key={tile.id}>
                    {tile.empty ? (
                      <div
                        className={cn(TILE, RESOURCE, "opacity-45 shadow-none grayscale")}
                        style={style}
                      >
                        {body}
                      </div>
                    ) : (
                      <button
                        type="button"
                        aria-controls={tile.id}
                        aria-expanded={open === tile.id}
                        onClick={() => choose(tile.id)}
                        className={cn(TILE, RESOURCE, open === tile.id && ACTIVE)}
                        style={style}
                      >
                        {body}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </div>
      {topics.length > 1 ? (
        <TopicJumpBar
          topics={topics}
          open={open}
          heading={labels.articles ?? t.chapters}
          after={tilesRef}
          // Like Previous / Next: open it and start reading from its top.
          onChoose={(id) => choose(id, "start")}
        />
      ) : null}
      <div className="mt-10">
        {panels(topicPanels)}
        {panels(tilePanels)}
      </div>
    </div>
  );
}
