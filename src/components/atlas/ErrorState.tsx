import Link from "@/components/i18n/Link";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";

/**
 * Jediný vzhled chybové a „nenalezeno" stránky (404, chyba při načtení).
 * Na mapových stránkách se vykreslí v panelu, globus zůstane.
 */
export function ErrorState({
  code,
  title,
  lead,
  action,
}: {
  code?: string;
  title: string;
  lead: string;
  action?: ReactNode;
}) {
  return (
    <div className="px-6 pt-10 pb-12" role="alert" aria-live="polite">
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
          Back to the globe
        </Link>
      </div>
    </div>
  );
}
