"use client";

import { type ReactNode, useState, useSyncExternalStore } from "react";
import { useMessages } from "@/components/i18n/LocaleProvider";
import { format } from "@/features/i18n/messages";
import { cn } from "@/lib/cn";
import type { TileIcon } from "../constants";
import { TILE, TileFace, tileStyle } from "./TileFace";

export interface TopicTileData {
  /** Panel id, also the URL hash (`topic-2`). */
  id: string;
  title: string;
  image?: string;
  background?: string;
}

export interface LearnTileData {
  id: string;
  label: string;
  description: string;
  icon: TileIcon;
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

const ACTIVE = "ring-2 ring-[var(--color-accent)] ring-offset-2";
const HEADING = "text-[11px] font-medium tracking-[0.1em] text-[var(--color-ink-muted)] uppercase";

/**
 * The topic's two halves: articles on the left, "Learn more" on the right,
 * each a two-column grid of photo tiles that simply grows by rows. A tile
 * opens its panel below; every panel is in the HTML (search engines, print),
 * only the open one is shown. The open panel is mirrored in the URL hash.
 */
export function DossierExplorer({
  topics,
  tiles,
  panels,
  labels = {},
}: {
  topics: TopicTileData[];
  tiles: LearnTileData[];
  panels: Record<string, ReactNode>;
  /** Headings of the two halves set in the topic; missing = the default texts. */
  labels?: { articles?: string; learnMore?: string };
}) {
  const t = useMessages().article;
  const hash = useSyncExternalStore(subscribe, readHash, noHash);
  const [chosen, setChosen] = useState<string | null>(null);
  const fallback = topics[0]?.id ?? tiles.find((tile) => !tile.empty)?.id ?? null;
  // Older links pointed at `#chapter-3`; topics took their place.
  const wanted = hash.replace(/^chapter-/, "topic-");
  const open = chosen ?? (wanted in panels ? wanted : fallback);

  const choose = (id: string) => {
    setChosen(id);
    window.history.replaceState(null, "", `#${id}`);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  return (
    <div className="@container mt-8">
      <div className="grid gap-6 @xl:grid-cols-2 @xl:gap-5">
        {topics.length ? (
          <section aria-labelledby="dossier-topics">
            <h2 id="dossier-topics" className={HEADING}>
              {labels.articles ?? t.topics}
            </h2>
            <ul className="mt-3 grid grid-cols-2 gap-2.5">
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
                      className={cn(TILE, "w-full", open === topic.id && ACTIVE)}
                      style={tileStyle(topic.image, topic.background)}
                    >
                      <TileFace
                        kicker={format(t.topic, { number: String(index + 1) })}
                        label={topic.title}
                      />
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
            <ul className="mt-3 grid grid-cols-2 gap-2.5">
              {tiles.map((tile) => {
                const style = tileStyle(tile.image, tile.background);
                const body = (
                  <TileFace
                    icon={tile.icon}
                    label={tile.label}
                    note={
                      tile.empty
                        ? t.comingSoon
                        : tile.count === 1
                          ? t.resourcesOne
                          : tile.count
                            ? format(t.resourcesCount, { count: String(tile.count) })
                            : tile.description
                    }
                  />
                );
                return (
                  <li key={tile.id}>
                    {tile.empty ? (
                      <div className={cn(TILE, "opacity-45 grayscale")} style={style}>
                        {body}
                      </div>
                    ) : (
                      <button
                        type="button"
                        aria-controls={tile.id}
                        aria-expanded={open === tile.id}
                        onClick={() => choose(tile.id)}
                        className={cn(TILE, "w-full", open === tile.id && ACTIVE)}
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

      {Object.entries(panels).map(([id, panel]) => (
        <div
          key={id}
          id={id}
          className={cn("scroll-mt-4", open === id ? "block" : "hidden print:block")}
        >
          {panel}
        </div>
      ))}
    </div>
  );
}
