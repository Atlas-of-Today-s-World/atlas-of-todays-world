import Link from "@/components/i18n/Link";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";

/**
 * The single look for error and "not found" pages (404, load error).
 * On map pages it renders in the panel and the globe stays.
 */
export function ErrorState({
  code,
  title,
  lead,
  action,
  backLabel = "Back to the globe",
  live = false,
}: {
  code?: string;
  title: string;
  lead: string;
  action?: ReactNode;
  /** Text of the back-to-globe link in the page language (`common.backToGlobe`); the default is for the admin. */
  backLabel?: string;
  /**
   * Announce it as soon as it appears — for an error that happens while the visitor
   * is on the page (error boundaries). A 404 or maintenance page is simply the page:
   * no alert role, which made screen readers read the whole block out of turn.
   */
  live?: boolean;
}) {
  return (
    <div className="px-6 pt-10 pb-12" role={live ? "alert" : undefined}>
      {code ? (
        <p className="text-[12px] font-medium tracking-[0.12em] text-[var(--color-ink-muted)] uppercase">
          {code}
        </p>
      ) : null}
      <h1 className="font-display mt-2 text-[26px] leading-tight font-bold text-[var(--color-ink)]">
        {title}
      </h1>
      <p className="mt-3 max-w-md text-[14px] leading-relaxed text-[var(--color-ink-soft)]">
        {lead}
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        {action}
        <Link href="/" className={buttonVariants({ variant: action ? "outline" : "primary" })}>
          {backLabel}
        </Link>
      </div>
    </div>
  );
}
