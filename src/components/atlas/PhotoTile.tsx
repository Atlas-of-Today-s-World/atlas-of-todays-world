import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps, CSSProperties, ReactNode } from "react";
import Link from "@/components/i18n/Link";
import { cn } from "@/lib/cn";
import { PHOTO_WIDTH } from "@/lib/images";
import { cssBackgroundImage } from "@/lib/security/urls";
import { HEX_COLOR } from "@/lib/validation/hex-color";

/**
 * Inline background of a photo tile: the photo wins, otherwise the admin's
 * colour; nothing when neither is usable (the tile's ink colour shows). The
 * URL goes through the CSS escaping of cssBackgroundImage (resized to `width`
 * for our own photos), the colour must be a plain `#rrggbb`.
 */
export function tileStyle(
  image: string | null | undefined,
  background: string | null | undefined,
  width: number = PHOTO_WIDTH.tile,
): CSSProperties | undefined {
  const photo = cssBackgroundImage(image, width);
  const style: CSSProperties = {};
  if (photo) style.backgroundImage = photo;
  if (background && HEX_COLOR.test(background)) style.backgroundColor = background;
  return photo || style.backgroundColor ? style : undefined;
}

const tile = cva(
  // `isolate` keeps the shade (z -1) above the photo and below the text, so content needs no `relative`.
  "group relative isolate flex w-full flex-col justify-end overflow-hidden rounded-xl bg-[var(--color-ink)] bg-cover bg-center text-left text-white transition focus-visible:outline-none",
  {
    variants: {
      /** Padding; the title's type scale follows it (`title` below). */
      size: { sm: "p-2 sm:p-2.5", md: "p-3", lg: "p-3.5", xl: "p-3.5" },
      /** `end`: content on the right (the Next tile of a stepper). Also places it in its grid cell. */
      align: { start: "", end: "items-end justify-self-end text-right" },
      /** Text under the title (stack) or an icon beside the text (row, half-height tiles). */
      layout: { stack: "", row: "flex-row items-center justify-start gap-3 py-2" },
      /** On a light page (accent focus ring) or over the dark map (white ring). */
      tone: {
        light:
          "focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2",
        dark: "focus-visible:ring-2 focus-visible:ring-white/80",
      },
      /** Shadow and the hover lift. */
      effect: {
        none: "",
        lift: "hover:-translate-y-0.5",
        shadow: "shadow-sm hover:shadow-lg",
        raised: "shadow-md hover:-translate-y-0.5 hover:shadow-xl",
      },
      /** The open or current one: outlined. */
      active: { true: "", false: "" },
      /** Nothing behind it yet: greyed out. */
      disabled: { true: "opacity-45 shadow-none grayscale", false: "" },
    },
    compoundVariants: [
      { active: true, tone: "light", class: "ring-2 ring-[var(--color-accent)] ring-offset-2" },
      { active: true, tone: "dark", class: "ring-2 ring-white" },
    ],
    defaultVariants: {
      size: "md",
      align: "start",
      layout: "stack",
      tone: "light",
      effect: "none",
      active: false,
      disabled: false,
    },
  },
);

/** The one shade over every photo tile: dark at the foot, so white text stays legible. */
const SHADE =
  "pointer-events-none absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/40 to-black/5 transition group-hover:from-black/90";

const kicker = cva("font-medium text-white/75 uppercase", {
  variants: {
    size: {
      sm: "mb-0.5 truncate text-[9.5px] tracking-[0.08em]",
      md: "mb-1 text-[10.5px] tracking-[0.1em]",
      lg: "mb-1 text-[10.5px] tracking-[0.1em]",
      xl: "mb-1 text-[10.5px] tracking-[0.1em]",
    },
  },
  defaultVariants: { size: "md" },
});

const title = cva("font-display", {
  variants: {
    size: {
      sm: "line-clamp-2 text-[12px] leading-tight font-semibold sm:text-[12.5px]",
      md: "text-[13px] leading-snug font-bold break-words",
      lg: "text-[15px] leading-tight font-semibold text-balance sm:text-[16px]",
      xl: "line-clamp-3 text-[18px] leading-tight font-semibold text-balance sm:text-[19px]",
    },
  },
  defaultVariants: { size: "md" },
});

type TileVariants = VariantProps<typeof tile>;

interface TileContent extends Omit<TileVariants, "active" | "disabled"> {
  active?: boolean;
  disabled?: boolean;
  /** Photo URL (any https; our own photos come resized to `width`). */
  image?: string | null;
  /** `#rrggbb` shown when there is no photo. */
  background?: string | null;
  /** Width the photo is requested at (PHOTO_WIDTH). */
  width?: number;
  /** Before the text: an icon chip, a "Previous" label (push it to the top with `mb-auto`). */
  badge?: ReactNode;
  /** Small uppercase line over the title. */
  kicker?: ReactNode;
  title?: ReactNode;
  titleClassName?: string;
  /** After the title (a note), or the whole content of a `row` tile. */
  children?: ReactNode;
  className?: string;
}

type Own = keyof TileContent | "style";
type AsLink = TileContent & Omit<ComponentProps<typeof Link>, Own>;
type AsButton = TileContent &
  Omit<ComponentProps<"button">, Own | "type"> & { href?: never; onClick: () => void };
type AsBox = TileContent & Omit<ComponentProps<"div">, Own> & { href?: never; onClick?: never };

/** A link (`href`), a button (`onClick`) or, with neither, a static box (previews, empty tiles). */
export type PhotoTileProps = AsLink | AsButton | AsBox;

/**
 * The one photo tile of the Atlas: a photo (or the admin's colour, or ink)
 * under one dark shade, with a small kicker and the title at its foot. Used by
 * the subtopic and resource tiles of a topic, Previous / Next, related topics
 * and entries in a portrait, the tiles over the home map and the admin
 * preview. Height and width come from the place (`className`): a grid cell,
 * a rail item, a strip on the map.
 */
export function PhotoTile(props: PhotoTileProps) {
  const {
    size,
    align,
    layout,
    tone,
    effect,
    active,
    disabled,
    image,
    background,
    width,
    badge,
    kicker: kickerText,
    title: titleText,
    titleClassName,
    children,
    className,
    ...rest
  } = props;
  const classes = cn(tile({ size, align, layout, tone, effect, active, disabled }), className);
  const style = tileStyle(image, background, width);
  const content = (
    <>
      <span aria-hidden className={SHADE} />
      {badge}
      {kickerText ? <span className={kicker({ size })}>{kickerText}</span> : null}
      {titleText ? <span className={cn(title({ size }), titleClassName)}>{titleText}</span> : null}
      {children}
    </>
  );
  if (rest.href !== undefined) {
    return (
      <Link {...(rest as Omit<AsLink, Own>)} className={classes} style={style}>
        {content}
      </Link>
    );
  }
  if (rest.onClick) {
    return (
      <button type="button" {...(rest as Omit<AsButton, Own>)} className={classes} style={style}>
        {content}
      </button>
    );
  }
  return (
    <div {...(rest as Omit<AsBox, Own>)} className={classes} style={style}>
      {content}
    </div>
  );
}
