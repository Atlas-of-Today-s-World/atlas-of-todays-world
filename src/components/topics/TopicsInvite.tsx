import { HandHeart, PenLine } from "lucide-react";
import Link from "@/components/i18n/Link";
import { format } from "@/features/i18n/messages";
import { volunteerHref } from "@/features/volunteers/prefill";
import { cn } from "@/lib/cn";
import { routes } from "@/config/routes";

/** The texts it needs from the `topics` messages (server getT or client useMessages). */
type InviteMessages = Record<
  "inviteTitle" | "inviteText" | "inviteMore" | "inviteWrite" | "inviteSupport",
  string
>;

const PILL =
  "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-[13px] font-medium transition focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:outline-none";

/**
 * Invitation to take part where a place has few or no topics: write one as an
 * editor (the volunteer application form with the place filled in; no mail
 * client needed, the team sees it in the admin) or support the Atlas as a
 * patron. `full` for a place without topics, otherwise one line.
 */
export function TopicsInvite({
  t,
  place,
  full = false,
  className,
}: {
  t: InviteMessages;
  place: string;
  full?: boolean;
  className?: string;
}) {
  const write = volunteerHref(place);
  if (!full) {
    return (
      <p className={cn("text-[12.5px] leading-relaxed text-[var(--color-ink-muted)]", className)}>
        {format(t.inviteMore, { place })}{" "}
        <Link href={write} className="font-medium text-[var(--color-link)] hover:underline">
          {t.inviteWrite}
        </Link>
        {" · "}
        <Link
          href={routes.membership}
          className="font-medium text-[var(--color-link)] hover:underline"
        >
          {t.inviteSupport}
        </Link>
      </p>
    );
  }
  return (
    <aside
      className={cn(
        "rounded-2xl border border-dashed border-[var(--color-line)] bg-[var(--color-accent-soft)]/40 p-4",
        className,
      )}
    >
      <p className="font-display text-[15px] font-bold text-[var(--color-ink)]">
        {format(t.inviteTitle, { place })}
      </p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-ink-soft)]">
        {format(t.inviteText, { place })}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={write}
          className={cn(PILL, "bg-[var(--color-ink)] text-white hover:bg-[var(--color-accent)]")}
        >
          <PenLine aria-hidden className="size-4" />
          {t.inviteWrite}
        </Link>
        <Link
          href={routes.membership}
          className={cn(
            PILL,
            "border border-[var(--color-line)] bg-white text-[var(--color-ink)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]",
          )}
        >
          <HandHeart aria-hidden className="size-4" />
          {t.inviteSupport}
        </Link>
      </div>
    </aside>
  );
}
