import { ArrowRight } from "lucide-react";
import { PhotoTile } from "@/components/atlas/PhotoTile";
import Link from "@/components/i18n/Link";
import { TopicsInvite } from "@/components/topics/TopicsInvite";
import type { EntrySummary } from "@/features/entries/queries";
import { format } from "@/features/i18n/messages";
import { getT } from "@/features/i18n/request";
import { cn } from "@/lib/cn";
import { routes } from "@/config/routes";

/**
 * "See all 5 topics →" — to the Topics list filtered to this place. A spark
 * runs round its edge (`spark-ring`, globals.css) to draw the eye to it.
 */
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
        "spark-ring inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--color-ink)] px-4 text-[13px] font-medium text-white transition hover:bg-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:outline-none",
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
 * photo tiles (at most six), the link to all of them and an invitation to
 * write or support more. With no topic yet, only the invitation.
 */
export function RelatedTopics({
  items,
  href,
  place,
  className,
}: {
  items: EntrySummary[];
  href: string;
  /** Name of the country, region or global issue, for the invitation. */
  place: string;
  className?: string;
}) {
  const t = getT().topics;
  if (!items.length) {
    return (
      <div className={cn("mt-8", className)}>
        <TopicsInvite t={t} place={place} full />
      </div>
    );
  }
  return (
    <section aria-labelledby="related-topics" className={cn("mt-8", className)}>
      <h2
        id="related-topics"
        className="font-display text-[18px] font-bold text-[var(--color-ink)]"
      >
        {t.related}
      </h2>
      <ul className="mt-3 grid grid-cols-2 gap-2.5">
        {items.slice(0, 6).map((item) => (
          <li key={item.slug}>
            <PhotoTile
              href={routes.topic(item.slug)}
              className="min-h-28"
              image={item.hero}
              title={item.title}
            />
          </li>
        ))}
      </ul>
      <TopicsLink count={items.length} href={href} className="mt-4" />
      <TopicsInvite t={t} place={place} className="mt-3" />
    </section>
  );
}
