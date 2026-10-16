"use client";

import { Mail } from "lucide-react";
import { usePathname } from "next/navigation";
import { glassVariants } from "@/components/atlas/glass";
import Link from "@/components/i18n/Link";
import { useMessages } from "@/components/i18n/LocaleProvider";
import { RAIL_OFFSET, railKind } from "@/config/layout";
import { splitLocale, withoutDefaultPrefix } from "@/lib/i18n/config";
import { cn } from "@/lib/cn";
import { DonateCoin } from "./DonateCoin";
import { routes } from "@/config/routes";

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
  const onNewsletter = splitLocale(withoutDefaultPrefix(pathname)).path === routes.newsletter;

  return (
    <div
      className={cn(
        "z-floating pointer-events-none fixed right-3 bottom-3 flex flex-col items-end gap-2 sm:right-5",
        rail !== "none" && ["max-md:hidden", RAIL_OFFSET[rail]],
      )}
    >
      {newsletter && !onNewsletter ? (
        <Link
          href={routes.newsletter}
          // Site-wide chrome (every page shows it): prefetch on intent, see MenuLink.
          prefetchOnIntent
          data-print="hide"
          className={cn(glassVariants({ kind: "pill" }), "focus-visible:outline-white")}
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
      <DonateCoin label={t.home.support} />
    </div>
  );
}
