import { CalendarClock, Check, Hourglass, HeartHandshake } from "lucide-react";
import Link from "@/components/i18n/Link";
import type { GroupStatus } from "@/features/geography/content-status";
import type { Messages } from "@/lib/i18n/messages";
import { cn } from "@/lib/cn";
import { routes } from "@/config/routes";

/** Done: a region completed, an issue ready. */
const isDone = (status: GroupStatus) => status === "ready" || status === "completed";

/**
 * Check mark for done content, hourglass for content in preparation, calendar
 * for a planned region, nothing for an untouched issue — the same marks as
 * inside the topic pills on the globe.
 */
export function StatusMark({ status, className }: { status: GroupStatus; className?: string }) {
  if (status === "none") return null;
  const Icon = isDone(status) ? Check : status === "planned" ? CalendarClock : Hourglass;
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center rounded-full text-white",
        isDone(status) ? "bg-[var(--color-status-ready)]" : "bg-[var(--color-status-preparing)]",
        className,
      )}
    >
      <Icon size={10} strokeWidth={3} />
    </span>
  );
}

const badge =
  "inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-medium";

/**
 * How far the portrait's content is, under its heading. Done and in
 * preparation are quiet facts; a place nobody has started on asks for support
 * and links to Atlas Patrons — the site raises money per region: a planned
 * region in the amber of its pill on the globe, an untouched issue in red.
 */
export function ContentStatusBadge({ status, t }: { status: GroupStatus; t: Messages }) {
  if (status === "planned") {
    return (
      <Link
        href={routes.membership}
        className={cn(
          badge,
          // A link, so a full touch target (the quiet badges below are just text).
          "min-h-(--touch-min) border-[var(--color-status-preparing)] bg-[var(--color-status-preparing)]/10 px-3.5 font-semibold text-[var(--color-status-preparing-text)] transition hover:bg-[var(--color-status-preparing-text)] hover:text-white focus-visible:ring-2 focus-visible:ring-[var(--color-status-preparing)] focus-visible:ring-offset-2 focus-visible:outline-none",
        )}
      >
        <CalendarClock size={14} aria-hidden />
        <span className="sr-only">{t.portrait.statusLabel}: </span>
        {t.portrait.statusPlanned}
      </Link>
    );
  }
  if (status === "none") {
    return (
      <Link
        href={routes.membership}
        className={cn(
          badge,
          // A link, so a full touch target (the quiet badges below are just text).
          "min-h-(--touch-min) border-[var(--color-empty)] bg-[var(--color-empty-soft)] px-3.5 font-semibold text-[var(--color-empty-strong)] transition hover:bg-[var(--color-empty)] hover:text-white focus-visible:ring-2 focus-visible:ring-[var(--color-empty)] focus-visible:ring-offset-2 focus-visible:outline-none",
        )}
      >
        <HeartHandshake size={14} aria-hidden />
        {t.portrait.statusNone}
      </Link>
    );
  }
  return (
    <span
      className={cn(
        badge,
        isDone(status)
          ? "border-[var(--color-status-ready)]/40 text-[var(--color-status-ready-text)]"
          : "border-[var(--color-status-preparing)]/45 text-[var(--color-status-preparing-text)]",
      )}
    >
      <StatusMark status={status} />
      <span className="sr-only">{t.portrait.statusLabel}: </span>
      {status === "completed"
        ? t.portrait.statusCompleted
        : status === "ready"
          ? t.portrait.statusReady
          : t.portrait.inPreparation}
    </span>
  );
}
