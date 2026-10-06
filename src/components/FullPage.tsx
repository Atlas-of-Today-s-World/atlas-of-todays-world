import type { ReactNode } from "react";
import Header from "@/components/Header";
import { LegalFooter } from "@/components/PagesShell";
import type { Messages } from "@/features/i18n/messages";

/**
 * Full-width page over the map (Topics, encyclopedia entries). It rises over
 * the globe while the globe shrinks into its window bottom left (AtlasGlobe);
 * "Back to Atlas" in the dark header (Header `bar`) and the window itself lead back to the
 * map, which grows to full size again. The page scrolls on its own, the map
 * underneath stays mounted.
 */
export function FullPage({
  t,
  showNews,
  newsletter,
  children,
}: {
  t: Messages;
  showNews: boolean;
  newsletter: boolean;
  children: ReactNode;
}) {
  return (
    <div
      id="content"
      tabIndex={-1}
      className="panel-scroll fixed inset-0 z-[45] animate-[full-page-in_0.6s_cubic-bezier(0.22,1,0.36,1)_both] overflow-y-auto bg-[var(--color-paper)] text-[var(--color-ink)] outline-none"
    >
      <Header bar showNews={showNews} newsletter={newsletter} />

      {children}

      <LegalFooter t={t} width="max-w-7xl" />
      {/* Room at the end so the globe window bottom left never covers the last lines. */}
      <div aria-hidden className="h-[calc(var(--mini-globe-height)+2rem)]" />
    </div>
  );
}
