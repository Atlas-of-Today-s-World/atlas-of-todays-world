import { PenLine } from "lucide-react";
import Link from "@/components/i18n/Link";
import { volunteerHref } from "@/config/routes";
import { format } from "@/lib/i18n/messages";
import { getT } from "@/lib/i18n/request";
import { cn } from "@/lib/cn";

/**
 * A place with no topic yet — the red 0 on the globe — says so loudly at the
 * top of its panel: nothing is written about it, join us and create it. The
 * button opens the volunteer editors' form with the place filled in. Shown only
 * when the count is 0 (otherwise "See all N topics" takes this spot).
 */
export async function NoTopicsCta({
  count,
  place,
  className,
}: {
  count: number;
  place: string;
  className?: string;
}) {
  if (count) return null;
  const t = (await getT()).topics;
  return (
    <aside
      aria-labelledby="no-topics-title"
      className={cn(
        "rounded-2xl border-2 border-[var(--color-empty)] bg-[var(--color-empty-soft)] p-4",
        className,
      )}
    >
      <p
        id="no-topics-title"
        className="font-display text-[16px] leading-snug font-bold text-[var(--color-empty-strong)]"
      >
        {format(t.emptyTitle, { place })}
      </p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-ink-soft)]">
        {format(t.emptyText, { place })}
      </p>
      <Link
        href={volunteerHref(place)}
        className="mt-3 inline-flex min-h-(--touch-min) items-center gap-2 rounded-full bg-[var(--color-empty)] px-5 text-[13.5px] font-semibold text-white shadow-sm transition hover:bg-[var(--color-empty-strong)] focus-visible:ring-2 focus-visible:ring-[var(--color-empty)] focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <PenLine aria-hidden className="size-4" />
        {t.emptyCta}
      </Link>
    </aside>
  );
}
