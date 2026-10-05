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
  "group relative flex w-full flex-col justify-end overflow-hidden rounded-xl bg-[var(--color-ink)] bg-cover bg-center p-3.5 text-left text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2";
const SHADE =
  "pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/5 transition group-hover:from-black/90";
const ACTIVE = "ring-2 ring-[var(--color-accent)] ring-offset-2";
const HEADING = "font-display text-[26px] font-semibold tracking-tight sm:text-[30px]";
/** Rows of tiles across the full width of the page. */
const ROW = "mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6";

/**
 * The dossier across the full width of the page: a row of chapter cards with
 * the open chapter right below it, then the "Learn more" row with its open
 * panel. Every panel is in the HTML (search engines, print), only the open one
 * is shown; it is mirrored in the URL hash (`#topic-2`, `#learn-videos`).
 */
export function DossierExplorer({
  topics,
  tiles,
  topicPanels,
  tilePanels,
}: {
  topics: TopicTileData[];
  tiles: LearnTileData[];
  topicPanels: Record<string, ReactNode>;
  tilePanels: Record<string, ReactNode>;
}) {
  const t = useMessages().article;
  const hash = useSyncExternalStore(subscribe, readHash, noHash);
  const [chosen, setChosen] = useState<string | null>(null);
  const fallback = topics[0]?.id ?? tiles.find((tile) => !tile.empty)?.id ?? null;
  // Older links pointed at `#chapter-3`; topics took their place.
  const wanted = hash.replace(/^chapter-/, "topic-");
  const open = chosen ?? (wanted in topicPanels || wanted in tilePanels ? wanted : fallback);

  const choose = (id: string) => {
    setChosen(id);
    window.history.replaceState(null, "", `#${id}`);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const panels = (record: Record<string, ReactNode>) => (
    <div className="mx-auto max-w-3xl">
      {Object.entries(record).map(([id, panel]) => (
        <div
          key={id}
          id={id}
          className={cn("scroll-mt-24", open === id ? "block" : "hidden print:block")}
        >
          {panel}
        </div>
      ))}
    </div>
  );

  return (
    <div className="mt-12">
      {topics.length ? (
        <section aria-labelledby="dossier-topics">
          <h2 id="dossier-topics" className={HEADING}>
            {t.chapters}
          </h2>
          <ul className={ROW}>
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
                    className={cn(
                      TILE,
                      "aspect-[4/5] sm:aspect-[3/5]",
                      open === topic.id && ACTIVE,
                    )}
                    style={image ? { backgroundImage: image } : undefined}
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
          {panels(topicPanels)}
        </section>
      ) : null}

      {tiles.length ? (
        <section aria-labelledby="dossier-learn-more" className="mt-14">
          <h2 id="dossier-learn-more" className={HEADING}>
            {t.learnMore}
          </h2>
          <ul className={ROW}>
            {tiles.map((tile) => {
              const Icon = ICONS[tile.icon];
              const image = cssBackgroundImage(tile.image);
              const body = (
                <>
                  <span aria-hidden className={SHADE} />
                  <span className="relative mb-auto grid size-9 place-items-center rounded-full bg-white/15 backdrop-blur-sm">
                    <Icon aria-hidden className="size-4.5" />
                  </span>
                  <span className="font-display relative mt-3 text-[14px] leading-snug font-bold">
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
                      className={cn(TILE, "min-h-36 opacity-45 shadow-none grayscale")}
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
                      className={cn(TILE, "min-h-36", open === tile.id && ACTIVE)}
                      style={image ? { backgroundImage: image } : undefined}
                    >
                      {body}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {panels(tilePanels)}
        </section>
      ) : null}
    </div>
  );
}
