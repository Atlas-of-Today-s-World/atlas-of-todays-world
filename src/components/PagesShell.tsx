import type { ReactNode } from "react";
import Header, { MenuLink } from "@/components/Header";
import { getNavigation } from "@/features/navigation/queries";
import type { NavLink } from "@/features/navigation/model";
import { getSiteSettings, getSocialLinks } from "@/features/site/queries";
import type { Messages } from "@/features/i18n/messages";
import { cn } from "@/lib/cn";
import { captchaEnabled } from "@/lib/security/turnstile";

/**
 * Frame of the pages without the globe (About, News, Atlas Patrons…): the
 * site's dark header bar and the light footer. `bleed` leaves the content full width so a page can draw
 * its own full-width bands (the membership page); otherwise the content sits
 * in the usual reading column.
 */
export async function PagesShell({
  t,
  newsletter,
  bleed = false,
  children,
}: {
  t: Messages;
  newsletter: boolean;
  bleed?: boolean;
  children: ReactNode;
}) {
  // Header and footer line up with the content column.
  const width = bleed ? "max-w-6xl" : "max-w-4xl";
  const [site, socials, nav] = await Promise.all([
    getSiteSettings(),
    getSocialLinks(),
    getNavigation(),
  ]);

  return (
    // A column at least the window's height: on short pages (no search results,
    // sign-in) the footer stays at the bottom instead of floating mid-screen.
    <div className="flex min-h-dvh flex-col bg-white text-[var(--color-ink)]">
      <Header bar newsletter={newsletter} captcha={captchaEnabled()} nav={nav} socials={socials} />
      <div
        id="content"
        tabIndex={-1}
        className={cn("w-full flex-1 outline-none", !bleed && "mx-auto max-w-4xl px-6 py-12")}
      >
        {children}
      </div>
      <LegalFooter t={t} width={width} copyright={site.copyright} links={nav.legal} />
    </div>
  );
}

/** Footer of pages without the globe and of full-width pages: © and the legal pages. */
export function LegalFooter({
  t,
  width,
  copyright,
  links,
}: {
  t: Messages;
  width: string;
  /** Footer line from Admin → Site settings. */
  copyright: string;
  /** Legal links from Admin → Site menus. */
  links: readonly NavLink[];
}) {
  return (
    <footer className="border-t border-[var(--color-line)]">
      <nav
        aria-label={t.header.legal}
        className={cn(
          "mx-auto flex flex-wrap gap-x-5 px-6 py-4 text-[12.5px] text-[var(--color-ink-muted)]",
          width,
        )}
      >
        <span className="flex min-h-11 items-center">{copyright}</span>
        {links.map((item) => (
          <MenuLink
            key={item.id}
            item={item}
            className="flex min-h-(--touch-min) min-w-(--touch-min) items-center justify-center hover:text-[var(--color-accent)]"
          />
        ))}
      </nav>
    </footer>
  );
}
