import type { ReactNode } from "react";
import Link from "@/components/i18n/Link";
import { BrandLogo } from "@/components/atlas/BrandLogo";
import { buttonVariants } from "@/components/ui/button";
import { ACCOUNT_NAV, LEGAL_NAV, MAIN_NAV } from "@/config/navigation";
import type { Messages } from "@/features/i18n/messages";
import { cn } from "@/lib/cn";

/**
 * Light header and footer of the pages without the globe (About, News,
 * Atlas Patrons…). `bleed` leaves the content full width so a page can draw
 * its own full-width bands (the membership page); otherwise the content sits
 * in the usual reading column.
 */
export function PagesShell({
  t,
  bleed = false,
  children,
}: {
  t: Messages;
  bleed?: boolean;
  children: ReactNode;
}) {
  const links = [...MAIN_NAV.filter((item) => !item.primary), ACCOUNT_NAV];
  const cta = MAIN_NAV.find((item) => item.primary);
  // Header and footer line up with the content column.
  const width = bleed ? "max-w-6xl" : "max-w-4xl";

  return (
    <div className="min-h-dvh bg-white text-[var(--color-ink)]">
      <header className="border-b border-[var(--color-line)]">
        <div
          className={cn(
            "mx-auto flex flex-wrap items-center justify-between gap-4 px-6 py-3",
            width,
          )}
        >
          <Link href="/" className="flex min-h-11 items-center">
            <BrandLogo className="h-5 sm:h-6" />
          </Link>
          <nav
            aria-label={t.header.main}
            className="flex flex-wrap items-center gap-x-5 text-[13px] text-[var(--color-ink-soft)]"
          >
            {links.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-h-11 items-center hover:text-[var(--color-accent)]"
              >
                {t.nav[item.key]}
              </Link>
            ))}
            {cta ? (
              <Link href={cta.href} className={buttonVariants({ variant: "patron", size: "sm" })}>
                {t.nav[cta.key]}
              </Link>
            ) : null}
          </nav>
        </div>
      </header>
      <div
        id="content"
        tabIndex={-1}
        className={cn("outline-none", !bleed && "mx-auto max-w-4xl px-6 py-12")}
      >
        {children}
      </div>
      <footer className="border-t border-[var(--color-line)]">
        <nav
          aria-label={t.header.legal}
          className={cn(
            "mx-auto flex flex-wrap gap-x-5 px-6 py-4 text-[12.5px] text-[var(--color-ink-muted)]",
            width,
          )}
        >
          <span className="flex min-h-11 items-center">© Atlas of Today&rsquo;s World</span>
          {LEGAL_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-h-11 items-center hover:text-[var(--color-accent)]"
            >
              {t.nav[item.key]}
            </Link>
          ))}
        </nav>
      </footer>
    </div>
  );
}
