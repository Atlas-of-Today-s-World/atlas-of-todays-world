"use client";

import {
  BookOpen,
  ChartColumn,
  Clapperboard,
  FileText,
  Globe,
  GraduationCap,
  Link as LinkIcon,
  type LucideIcon,
  Map as MapIcon,
  Mic,
  PenLine,
} from "lucide-react";
import { type ReactNode, useState, useSyncExternalStore } from "react";
import { useMessages } from "@/components/i18n/LocaleProvider";
import { format } from "@/features/i18n/messages";
import { cn } from "@/lib/cn";
import { cssBackgroundImage } from "@/lib/security/urls";
import type { TileIcon } from "../constants";

const ICONS: Record<TileIcon, LucideIcon> = {
  video: Clapperboard,
  chart: ChartColumn,
  book: BookOpen,
  graduation: GraduationCap,
  mic: Mic,
  pen: PenLine,
  map: MapIcon,
  link: LinkIcon,
  file: FileText,
  globe: Globe,
};

export interface TopicTileData {
  /** Panel id, also the URL hash (`topic-2`). */
  id: string;
  title: string;
  image?: string;
}

export interface LearnTileData {
  id: string;
  label: string;
  description: string;
  icon: TileIcon;
  image?: string;
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

/** Shared look of both tile kinds: photo or dark field, gradient for legible text. */
const TILE =
  "group relative flex min-h-32 flex-col justify-end overflow-hidden rounded-xl bg-[var(--color-ink)] bg-cover bg-center p-3 text-left text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 sm:min-h-36";
const SHADE =
  "pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/10 transition group-hover:from-black/90";
const ACTIVE = "ring-2 ring-[var(--color-accent)] ring-offset-2";
const HEADING = "text-[11px] font-medium tracking-[0.1em] text-[var(--color-ink-muted)] uppercase";

/**
 * The dossier's two halves: topics on the left, "Learn more" on the right,
 * each a two-column grid of photo tiles that simply grows by rows. A tile
 * opens its panel below; every panel is in the HTML (search engines, print),
 * only the open one is shown. The open panel is mirrored in the URL hash.
 */
export function DossierExplorer({
  topics,
  tiles,
  panels,
}: {
  topics: TopicTileData[];
  tiles: LearnTileData[];
  panels: Record<string, ReactNode>;
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
              {t.topics}
            </h2>
            <ul className="mt-3 grid grid-cols-2 gap-2.5">
              {topics.map((topic, index) => {
                const image = cssBackgroundImage(topic.image);
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
                      style={image ? { backgroundImage: image } : undefined}
                    >
                      <span aria-hidden className={SHADE} />
                      <span className="relative text-[10.5px] font-medium tracking-[0.1em] text-white/75 uppercase">
                        {format(t.topic, { number: String(index + 1) })}
                      </span>
                      <span className="font-display relative mt-1 text-[13px] leading-snug font-bold @3xl:text-[14px]">
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
              {t.learnMore}
            </h2>
            <ul className="mt-3 grid grid-cols-2 gap-2.5">
              {tiles.map((tile) => {
                const Icon = ICONS[tile.icon];
                const image = cssBackgroundImage(tile.image);
                const body = (
                  <>
                    <span aria-hidden className={SHADE} />
                    <span className="relative mb-auto grid size-9 place-items-center rounded-full bg-white/15 backdrop-blur-sm">
                      <Icon aria-hidden className="size-4.5" />
                    </span>
                    <span className="font-display relative mt-3 text-[13px] leading-snug font-bold @3xl:text-[14px]">
                      {tile.label}
                    </span>
                    <span className="relative mt-0.5 text-[11px] text-white/70">
                      {tile.empty
                        ? t.comingSoon
                        : tile.count === 1
                          ? t.resourcesOne
                          : tile.count
                            ? format(t.resourcesCount, { count: String(tile.count) })
                            : tile.description}
                    </span>
                  </>
                );
                return (
                  <li key={tile.id}>
                    {tile.empty ? (
                      <div
                        className={cn(TILE, "opacity-45 grayscale")}
                        style={image ? { backgroundImage: image } : undefined}
                      >
                        {body}
                      </div>
                    ) : (
                      <button
                        type="button"
                        aria-controls={tile.id}
                        aria-expanded={open === tile.id}
                        onClick={() => choose(tile.id)}
                        className={cn(TILE, "w-full", open === tile.id && ACTIVE)}
                        style={image ? { backgroundImage: image } : undefined}
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
