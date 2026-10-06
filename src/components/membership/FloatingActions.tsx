"use client";

import { Mail } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "@/components/i18n/Link";
import { useMessages } from "@/components/i18n/LocaleProvider";
import { RAIL_OFFSET, railKind } from "@/config/layout";
import { NEWSLETTER_PATH } from "@/config/navigation";
import { splitLocale, withoutDefaultPrefix } from "@/features/i18n/config";
import { cn } from "@/lib/cn";
import { DonateCoin } from "./DonateCoin";

/**
 * Bottom right on every public page (the map and pages layouts render it; not
 * the admin, not the donation pages): "Newsletter" over the gold-coin
 * "Support the Atlas" — the shorter button on top. On the map the stack moves
 * left of the right panel, and on phones it gives way to the panel's sheet.
 */
export function FloatingActions({
  onMap = false,
  newsletter,
}: {
  onMap?: boolean;
  /** The newsletter is switched on (flag). */
  newsletter: boolean;
}) {
  const pathname = usePathname();
  const t = useMessages();
  const rail = onMap ? railKind(pathname) : "none";
  const onNewsletter = splitLocale(withoutDefaultPrefix(pathname)).path === NEWSLETTER_PATH;

  return (
    <div
      className={cn(
        "pointer-events-none fixed right-3 bottom-3 z-[47] flex flex-col items-end gap-2 sm:right-5",
        rail !== "none" && ["max-md:hidden", RAIL_OFFSET[rail]],
      )}
    >
      {newsletter && !onNewsletter ? (
        <Link
          href={NEWSLETTER_PATH}
          data-print="hide"
          className="glass glass-hover pointer-events-auto relative flex h-[35px] min-w-[35px] items-center gap-2 rounded-full px-[4.5px] text-[11px] font-medium text-white transition before:absolute before:-inset-[4.5px] before:rounded-full before:content-[''] hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:pr-[13px]"
        >
          <span
            aria-hidden
            className="grid size-[26px] shrink-0 place-items-center rounded-full bg-[var(--color-patron)] text-white"
          >
            <Mail className="size-[13px]" strokeWidth={2.2} />
          </span>
          <span className="sr-only sm:not-sr-only">{t.newsletterPage.button}</span>
        </Link>
      ) : null}
      <DonateCoin label={t.home.support} className="relative" />
    </div>
  );
}
