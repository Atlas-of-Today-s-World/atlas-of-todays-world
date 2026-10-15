import type { ReactNode } from "react";
import Header from "@/components/Header";
import { LegalFooter } from "@/components/PagesShell";
import { RememberedScroll } from "@/components/RememberedScroll";
import type { Messages } from "@/features/i18n/messages";
import { getNavigation } from "@/features/navigation/queries";
import { getSiteSettings, getSocialLinks } from "@/features/site/queries";

/**
 * Full-width page over the map (Topics, encyclopedia entries). It rises over
 * the globe while the globe shrinks into its window bottom left (AtlasGlobe);
 * "Back to Atlas" in the dark header (Header `bar`) and the window itself lead back to the
 * map, which grows to full size again. The page scrolls on its own (Back
 * returns to the same spot, RememberedScroll), the map underneath stays mounted.
 */
export async function FullPage({
  t,
  newsletter,
  children,
}: {
  t: Messages;
  newsletter: boolean;
  children: ReactNode;
}) {
  const [site, socials, nav] = await Promise.all([
    getSiteSettings(),
    getSocialLinks(),
    getNavigation(),
  ]);
  return (
    <RememberedScroll
      id="content"
      tabIndex={-1}
      className="panel-scroll z-full-page fixed inset-0 animate-[full-page-in_0.6s_cubic-bezier(0.22,1,0.36,1)_both] overflow-y-auto bg-[var(--color-paper)] text-[var(--color-ink)] outline-none"
    >
      <Header bar newsletter={newsletter} nav={nav} socials={socials} />

      {children}

      <LegalFooter t={t} width="max-w-7xl" copyright={site.copyright} links={nav.legal} />
      {/* Room at the end so the globe window bottom left (on phones the floating
          buttons) never covers the last lines. */}
      <div aria-hidden className="h-28 sm:h-[calc(var(--mini-globe-height)+2rem)]" />
    </RememberedScroll>
  );
}
