import { ArrowRight } from "lucide-react";
import Link from "@/components/i18n/Link";
import { format } from "@/lib/i18n/messages";
import { getT } from "@/lib/i18n/request";
import { cn } from "@/lib/cn";

/**
 * "See all 5 topics →" — to the Topics list filtered to this place. A spark
 * runs round its edge (`spark-ring`, globals.css) to draw the eye to it.
 */
export async function TopicsLink({
  count,
  href,
  className,
}: {
  count: number;
  href: string;
  className?: string;
}) {
  const t = (await getT()).topics;
  if (!count) return null;
  return (
    <Link
      href={href}
      className={cn(
        "spark-ring inline-flex min-h-(--touch-min) items-center gap-2 rounded-full bg-[var(--color-ink)] px-4 text-[13px] font-medium text-white transition hover:bg-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:outline-none",
        className,
      )}
    >
      {count === 1 ? t.seeOne : format(t.seeAll, { count: String(count) })}
      <ArrowRight aria-hidden className="size-4" />
    </Link>
  );
}
