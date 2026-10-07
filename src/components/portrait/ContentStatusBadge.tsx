import { Check, Hourglass, HeartHandshake } from "lucide-react";
import Link from "@/components/i18n/Link";
import type { ContentStatus } from "@/features/geography/content-status";
import { MEMBERSHIP_PATH } from "@/features/membership/config";
import type { Messages } from "@/features/i18n/messages";
import { cn } from "@/lib/cn";

/**
 * Check mark for ready content, hourglass for content in preparation, nothing
 * before that — the same marks as inside the topic pills on the globe.
 */
export function StatusMark({ status, className }: { status: ContentStatus; className?: string }) {
  if (status === "none") return null;
  const Icon = status === "ready" ? Check : Hourglass;
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center rounded-full text-white",
        status === "ready" ? "bg-[#1e9e5a]" : "bg-[#d98a00]",
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
 * How far the portrait's content is, under its heading. Ready and in
 * preparation are quiet facts; a place nobody has started on asks for support
 * and links to Atlas Patrons — the site raises money per region.
 */
export function ContentStatusBadge({ status, t }: { status: ContentStatus; t: Messages }) {
  if (status === "none") {
    return (
      <Link
        href={MEMBERSHIP_PATH}
        className={cn(
          badge,
          "border-[var(--color-accent)] text-[var(--color-accent)] transition hover:bg-[var(--color-accent)] hover:text-white",
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
        status === "ready"
          ? "border-[#1e9e5a]/40 text-[#16794a]"
          : "border-[#d98a00]/45 text-[#9a6200]",
      )}
    >
      <StatusMark status={status} />
      <span className="sr-only">{t.portrait.statusLabel}: </span>
      {status === "ready" ? t.portrait.statusReady : t.portrait.inPreparation}
    </span>
  );
}
