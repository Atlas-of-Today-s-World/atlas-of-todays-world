import type { CSSProperties, ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "@/components/i18n/Link";
import { Breadcrumbs, type Crumb } from "@/components/atlas/Breadcrumbs";
import { ShareButton } from "@/components/atlas/ShareButton";
import { PhotoCredit } from "@/components/atlas/ui";
import { Photo } from "@/components/atlas/Photo";
import { PHOTO_WIDTH } from "@/lib/images";
import { safeUrl } from "@/lib/security/urls";
import { cn } from "@/lib/cn";
import { HEX_COLOR } from "@/lib/validation/hex-color";

/**
 * Content column of a full-width page (FullPage) under its photo header; its
 * left padding keeps the text clear of the globe window (pl-clear-globe-*).
 */
export const ARTICLE_BODY = "mx-auto max-w-6xl px-4 pt-6 pb-12 pl-clear-globe-6xl sm:pr-8";

/**
 * Sections drawn for the side panel (Portrait sections, Timeline, FAQ) bring
 * their own side padding (`px-6 sm:px-10`): this pulls them back to the
 * column's edges on a full-width page.
 */
export const PANEL_SECTION_BLEED = "-mx-6 sm:-mx-10";

/**
 * Colour wash of a header without a photo: the place's own colour fading into
 * night. Only a plain `#rrggbb` (CHECKed in the database too) — anything else
 * gives none and the header's own dark colour shows.
 */
export const heroWash = (color: string | null | undefined) =>
  color && HEX_COLOR.test(color)
    ? `linear-gradient(135deg, ${color} 0%, var(--color-space) 55%, var(--color-space-deep) 100%)`
    : undefined;

/** Inline background of the header: a photo covers it; else its colour, else the wash. */
export function heroStyle({
  photo,
  background,
  wash,
}: {
  photo: boolean;
  background?: string | null;
  wash?: string;
}): CSSProperties | undefined {
  if (background && HEX_COLOR.test(background)) return { backgroundColor: background };
  return !photo && wash ? { backgroundImage: wash } : undefined;
}

/**
 * Photo header of a full-width page (a topic, a global issue): the photo as
 * a real `<img>` (image search, early LCP) under a dark gradient, the trail
 * back up with Share at its right, the big title and the lead. Without a
 * photo, the `background` colour or `wash` gradient carries it.
 */
export function ArticleHero({
  image,
  alt,
  background,
  wash,
  credit,
  crumbs,
  crumbLabel,
  share,
  title,
  subtitle,
  summary,
}: {
  image?: string | null;
  /** Alternative text of the photo (the page's title). */
  alt: string;
  /** Plain colour behind the header (a topic's own). */
  background?: string;
  /** Gradient behind the header when there is no photo (`heroWash`). */
  wash?: string;
  /** Who took the photo (shown in its corner). */
  credit?: string;
  crumbs: Crumb[];
  /** Accessible name of the trail ("Breadcrumb"). */
  crumbLabel: string;
  /** Title to share; left out = no Share button (a secret preview link). */
  share?: string;
  title: string;
  /** A short line under the title (a global issue's subtitle). */
  subtitle?: string;
  summary?: string;
}) {
  const hero = safeUrl(image);
  return (
    <header
      className="relative isolate overflow-hidden bg-[var(--color-space)] text-white"
      style={heroStyle({ photo: Boolean(hero), background, wash })}
    >
      {/* A real <img>: image search indexes it, and as the page's LCP it is
          preloaded (Photo `priority`). A plain full-bleed background under the text. */}
      <Photo
        priority
        src={hero}
        alt={alt}
        widths={[PHOTO_WIDTH.card, 1200, PHOTO_WIDTH.hero]}
        sizes="100vw"
        width={1600}
        height={640}
        className="absolute inset-0 -z-10 h-full w-full object-cover"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-t from-[var(--color-space-deep)] via-[var(--color-space-deep)]/65 to-[var(--color-space-deep)]/15"
      />
      <div className="pl-clear-globe-6xl mx-auto flex min-h-72 max-w-6xl flex-col justify-end px-4 pt-16 pb-10 sm:min-h-96 sm:pr-8">
        {/* The way back up (the title follows); sharing at the right, above the title too. */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Breadcrumbs tone="dark" label={crumbLabel} items={crumbs} />
          {share ? (
            <ShareButton title={share} tone="dark" className="ml-auto flex-row-reverse" />
          ) : null}
        </div>
        <h1 className="font-display mt-3 text-[34px] leading-[1.08] font-bold text-balance sm:text-[52px]">
          {title}
        </h1>
        {subtitle ? (
          <p className="font-display mt-2 text-[17px] font-bold text-white/90 sm:text-[21px]">
            {subtitle}
          </p>
        ) : null}
        {summary ? (
          <p className="mt-4 text-[15px] leading-relaxed text-white/80 sm:text-[17px]">{summary}</p>
        ) : null}
      </div>
      {credit ? <PhotoCredit>{credit}</PhotoCredit> : null}
    </header>
  );
}

/** The end of a full-width page: back to its list, and Share once read. */
export function ArticleEnd({
  href,
  label,
  share,
  className,
}: {
  href: string;
  label: ReactNode;
  share: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mt-14 flex flex-wrap items-center gap-3 border-t border-[var(--color-line)] pt-6",
        className,
      )}
    >
      <Link
        href={href}
        className="inline-flex min-h-(--touch-min) items-center gap-2 rounded-full bg-[var(--color-ink)] px-5 text-[14px] font-medium text-white transition hover:bg-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {label}
      </Link>
      {/* Finished reading: the moment to pass it on. */}
      <ShareButton title={share} />
    </div>
  );
}
