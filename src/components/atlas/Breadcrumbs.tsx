import { Fragment, type ReactNode } from "react";
import Link from "@/components/i18n/Link";

/** One step of the trail: a link (`href`) or plain text. */
export interface Crumb {
  label: ReactNode;
  href?: string;
  /** Before the label (the pill's icon, e.g. the Topics grid). */
  icon?: ReactNode;
  /** Dark tone: the link as a glass pill — the step the reader most likely wants. */
  pill?: boolean;
  /** The page itself (`aria-current="page"`). */
  current?: boolean;
}

type Part = "list" | "item" | "separator" | "text" | "link";

/**
 * One class set per part of the trail and tone:
 * - light — the small muted trail on the light panels (country card); it flows as text;
 * - dark — over a photo header (encyclopedia entry), with 44 px link targets.
 */
const TONE: Record<"light" | "dark", Record<Part, string | undefined>> = {
  light: {
    list: "text-[12px] text-[var(--color-ink-muted)]",
    item: "inline",
    separator: "inline px-1.5",
    text: "inline text-[var(--color-ink)]",
    // The hit area reaches above and below the small text (44 px row).
    link: "relative font-medium text-[var(--color-link)] after:absolute after:inset-x-0 after:-inset-y-4 after:content-[''] hover:underline",
  },
  dark: {
    list: "flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] font-medium text-white/80",
    item: undefined,
    separator: "text-white/45",
    text: "tracking-[0.14em] uppercase",
    link: "inline-flex min-h-(--touch-min) min-w-(--touch-min) items-center hover:text-white hover:underline",
  },
};

const PILL =
  "inline-flex min-h-(--touch-min) items-center gap-1.5 rounded-full bg-white/15 px-3.5 text-white ring-1 ring-white/25 backdrop-blur transition hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none";

/**
 * The way back up from a page (ARCHITEKTURA 15.1): an ordered list in a
 * labelled `<nav>`, the steps separated by "›" (hidden from screen readers).
 */
export function Breadcrumbs({
  label,
  items,
  tone = "light",
  className,
}: {
  /** Accessible name of the nav ("Breadcrumb"), in the page language. */
  label: string;
  items: Crumb[];
  tone?: "light" | "dark";
  className?: string;
}) {
  const style = TONE[tone];
  return (
    <nav aria-label={label} className={className}>
      <ol className={style.list}>
        {items.map((item, index) => (
          <Fragment key={index}>
            {index > 0 ? (
              <li aria-hidden className={style.separator}>
                ›
              </li>
            ) : null}
            {item.href ? (
              <li className={style.item}>
                <Link href={item.href} className={item.pill ? PILL : style.link}>
                  {item.icon}
                  {item.label}
                </Link>
              </li>
            ) : (
              <li className={style.text} aria-current={item.current ? "page" : undefined}>
                {item.label}
              </li>
            )}
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
