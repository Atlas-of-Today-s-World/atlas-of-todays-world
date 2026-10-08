import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import Link from "@/components/i18n/Link";
import { cn } from "@/lib/cn";
import { PHOTO_WIDTH } from "@/lib/images";
import { cssBackgroundImage } from "@/lib/security/urls";

const card = cva(
  "group overflow-hidden bg-white text-[var(--color-ink)] transition focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none",
  {
    variants: {
      /**
       * sm — a source in a rail (outlined on hover), md — a news item in a rail
       * (lifted on hover), lg — a topic in the /topics grid (full cell height).
       */
      size: {
        sm: "block w-52 shrink-0 snap-start rounded-xl hover:ring-2 hover:ring-[var(--color-accent)]",
        md: "block w-56 shrink-0 snap-start rounded-xl hover:-translate-y-0.5",
        lg: "flex h-full flex-col rounded-2xl shadow-sm ring-1 ring-black/5 hover:-translate-y-0.5 hover:shadow-lg",
      },
    },
    defaultVariants: { size: "lg" },
  },
);

const header = cva("relative block w-full bg-[var(--color-ink)] bg-cover bg-center", {
  variants: { size: { sm: "h-24", md: "h-28", lg: "aspect-[16/10]" } },
  defaultVariants: { size: "lg" },
});

const body = cva("", {
  variants: { size: { sm: "p-3", md: "p-3", lg: "flex flex-1 flex-col p-5" } },
  defaultVariants: { size: "lg" },
});

const title = cva("font-display block leading-snug font-bold", {
  variants: {
    size: {
      sm: "text-[13px]",
      md: "text-[13.5px] group-hover:text-[var(--color-accent)]",
      lg: "mt-1.5 text-[19px] group-hover:text-[var(--color-accent)]",
    },
  },
  defaultVariants: { size: "lg" },
});

const description = cva("block", {
  variants: {
    size: {
      sm: "mt-1 text-[11px] text-[var(--color-ink-muted)]",
      md: "mt-1 line-clamp-3 text-[11.5px] leading-snug text-[var(--color-ink-muted)]",
      lg: "mt-2 line-clamp-3 text-[13.5px] leading-relaxed text-[var(--color-ink-soft)]",
    },
  },
  defaultVariants: { size: "lg" },
});

export interface PhotoCardProps extends VariantProps<typeof card> {
  href: string;
  /** Another site: opens in a new tab, without the language prefix. */
  external?: boolean;
  /** Photo URL; without a usable one the header is ink, or `placeholder`. */
  image?: string | null;
  /** Width the photo is requested at (PHOTO_WIDTH). */
  width?: number;
  /** Shown in a calm accent header when there is no photo (a source's category). */
  placeholder?: ReactNode;
  /** A soft shade over the photo, lighter on hover. */
  shade?: boolean;
  /** Small uppercase line over the title (lg). */
  kicker?: ReactNode;
  title: ReactNode;
  /** `h3` where the cards are items of a titled section. */
  titleAs?: "span" | "h3";
  description?: ReactNode;
  className?: string;
}

/**
 * The one white photo card: a photo header over a white body with the title
 * and a short text. Topics on /topics, news in a portrait, sources in "Learn
 * more". (Text over the photo itself is PhotoTile.)
 */
export function PhotoCard({
  href,
  external = false,
  image,
  width = PHOTO_WIDTH.tile,
  placeholder,
  shade = false,
  kicker,
  title: titleText,
  titleAs: Title = "span",
  description: text,
  size,
  className,
}: PhotoCardProps) {
  const photo = cssBackgroundImage(image, width);
  const content = (
    <>
      {photo || !placeholder ? (
        <span
          aria-hidden
          className={header({ size })}
          style={photo ? { backgroundImage: photo } : undefined}
        >
          {shade ? (
            <span className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-80 transition group-hover:opacity-100" />
          ) : null}
        </span>
      ) : (
        // No photo: the placeholder as a calm header, so a row of cards stays visual.
        <span
          className={cn(
            header({ size }),
            "flex items-end bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-space)] p-3 text-[10px] font-semibold tracking-[0.1em] text-white/85 uppercase",
          )}
        >
          {placeholder}
        </span>
      )}
      {/* A div: the title may be a heading. */}
      <div className={body({ size })}>
        {kicker ? (
          <span className="text-[11px] font-medium tracking-[0.1em] text-[var(--color-ink-muted)] uppercase">
            {kicker}
          </span>
        ) : null}
        <Title className={title({ size })}>{titleText}</Title>
        {text ? <span className={description({ size })}>{text}</span> : null}
      </div>
    </>
  );
  const classes = cn(card({ size }), className);
  return external ? (
    <a href={href} target="_blank" rel="noreferrer" className={classes}>
      {content}
    </a>
  ) : (
    <Link href={href} className={classes}>
      {content}
    </Link>
  );
}
