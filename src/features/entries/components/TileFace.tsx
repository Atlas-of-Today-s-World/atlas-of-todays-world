import type { ReactNode } from "react";
import { tileBackground } from "@/lib/tile-style";
import { PHOTO_WIDTH } from "@/lib/images";
import { TileIcon } from "./TileIcon";

/** Shared look of every topic tile: photo or colour field, gradient for legible text. */
export const TILE =
  "group relative flex min-h-32 flex-col justify-end overflow-hidden rounded-xl bg-[var(--color-ink)] bg-cover bg-center p-3 text-left text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 sm:min-h-36";
const SHADE =
  "pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/10 transition group-hover:from-black/90";

/** Inline background of a topic tile: the photo wins, otherwise its colour. */
export function tileStyle(image?: string | null, background?: string | null) {
  return tileBackground(image, background, PHOTO_WIDTH.tile);
}

/**
 * Inside of a tile: shade, an optional icon chip, an optional kicker line, the
 * label and a small note. The public dossier and the admin preview share it.
 */
export function TileFace({
  icon,
  kicker,
  label,
  note,
}: {
  icon?: string;
  kicker?: ReactNode;
  label: ReactNode;
  note?: ReactNode;
}) {
  return (
    <>
      <span aria-hidden className={SHADE} />
      {icon ? (
        <span className="relative mb-auto grid size-9 place-items-center rounded-full bg-white/15 backdrop-blur-sm">
          <TileIcon name={icon} className="size-4.5" />
        </span>
      ) : null}
      {kicker ? (
        <span className="relative text-[10.5px] font-medium tracking-[0.1em] text-white/75 uppercase">
          {kicker}
        </span>
      ) : null}
      <span
        className={`font-display relative ${icon ? "mt-3" : "mt-1"} text-[13px] leading-snug font-bold @3xl:text-[14px]`}
      >
        {label}
      </span>
      {note ? <span className="relative mt-0.5 text-[11px] text-white/70">{note}</span> : null}
    </>
  );
}
