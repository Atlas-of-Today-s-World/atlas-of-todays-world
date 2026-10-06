import { ArrowRight } from "lucide-react";
import Link from "@/components/i18n/Link";
import type { EntrySummary } from "@/features/entries/queries";
import { format } from "@/features/i18n/messages";
import { getT } from "@/features/i18n/request";
import { cn } from "@/lib/cn";
import { cssBackgroundImage } from "@/lib/security/urls";

/** "See all 5 topics →" — to the Topics list filtered to this place. */
export function TopicsLink({
  count,
  href,
  className,
}: {
  count: number;
  href: string;
  className?: string;
}) {
  const t = getT().topics;
  if (!count) return null;
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--color-ink)] px-4 text-[13px] font-medium text-white transition hover:bg-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:outline-none",
        className,
      )}
    >
      {count === 1 ? t.seeOne : format(t.seeAll, { count: String(count) })}
      <ArrowRight aria-hidden className="size-4" />
    </Link>
  );
}

/**
 * Related topics at the end of a country, region or global issue panel:
 * photo tiles (at most six) and the link to all of them.
 */
export function RelatedTopics({
  items,
  href,
  className,
}: {
  items: EntrySummary[];
  href: string;
  className?: string;
}) {
  const t = getT().topics;
  if (!items.length) return null;
  return (
    <section aria-labelledby="related-topics" className={cn("mt-8", className)}>
      <h2
        id="related-topics"
        className="font-display text-[18px] font-bold text-[var(--color-ink)]"
      >
        {t.related}
      </h2>
      <ul className="mt-3 grid grid-cols-2 gap-2.5">
        {items.slice(0, 6).map((item) => {
          const image = cssBackgroundImage(item.hero);
          return (
            <li key={item.slug}>
              <Link
                href={`/topics/${item.slug}`}
                className="group relative flex min-h-28 flex-col justify-end overflow-hidden rounded-xl bg-[var(--color-ink)] bg-cover bg-center p-3 text-white focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:outline-none"
                style={image ? { backgroundImage: image } : undefined}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/10 transition group-hover:from-black/90"
                />
                <span className="font-display relative text-[13px] leading-snug font-bold">
                  {item.title}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <TopicsLink count={items.length} href={href} className="mt-4" />
    </section>
  );
}
