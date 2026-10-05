import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "@/components/i18n/Link";
import { BrandLogo } from "@/components/atlas/BrandLogo";
import { LegalFooter } from "@/components/PagesShell";
import { buttonVariants } from "@/components/ui/button";
import { MAIN_NAV } from "@/config/navigation";
import type { Messages } from "@/features/i18n/messages";

/**
 * Full-width page over the map (Topics, encyclopedia entries). It rises over
 * the globe while the globe shrinks into its window bottom left (AtlasGlobe);
 * "Back to Atlas" in the dark header and the window itself lead back to the
 * map, which grows to full size again. The page scrolls on its own, the map
 * underneath stays mounted.
 */
export function FullPage({ t, children }: { t: Messages; children: ReactNode }) {
  const links = MAIN_NAV.filter((item) => item.href !== "/");

  return (
    <div
      id="content"
      tabIndex={-1}
      className="panel-scroll fixed inset-0 z-[45] animate-[full-page-in_0.6s_cubic-bezier(0.22,1,0.36,1)_both] overflow-y-auto bg-[var(--color-paper)] text-[var(--color-ink)] outline-none"
    >
      <header className="sticky top-0 z-10 bg-[var(--color-space-deep)] text-white">
        <div className="mx-auto grid min-h-16 max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 sm:px-8">
          <Link
            href="/"
            aria-label={t.header.home}
            className="flex min-h-11 items-center justify-self-start"
          >
            <BrandLogo tone="light" className="h-[18px] sm:h-6" />
          </Link>

          <Link
            href="/"
            className="flex min-h-11 items-center gap-2 justify-self-center rounded-full border border-white/25 px-4 text-[13px] font-medium transition hover:border-white/60 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none"
          >
            <ArrowLeft aria-hidden className="size-4" />
            {t.topics.backToAtlas}
          </Link>

          <nav
            aria-label={t.header.main}
            className="hidden items-center gap-2 justify-self-end text-[13px] lg:flex"
          >
            {links.map((item) =>
              item.primary ? (
                <Link
                  key={item.href}
                  href={item.href}
                  className={buttonVariants({ variant: "patron", size: "sm" })}
                >
                  {t.nav[item.key]}
                </Link>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex min-h-9 items-center rounded-md bg-white/10 px-3 font-medium transition hover:bg-white/20"
                >
                  {t.nav[item.key]}
                </Link>
              ),
            )}
          </nav>
        </div>
      </header>

      {children}

      <LegalFooter t={t} width="max-w-7xl" />
      {/* Room at the end so the globe window bottom left never covers the last lines. */}
      <div aria-hidden className="h-[calc(var(--mini-globe-height)+2rem)]" />
    </div>
  );
}
