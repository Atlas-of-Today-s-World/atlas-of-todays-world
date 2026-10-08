import { getT } from "@/features/i18n/request";
import ContentRail from "./ContentRail";

/**
 * Shown right after clicking the globe, before the panel content arrives.
 * Without it nothing at all would happen for a moment after the click.
 */
export default function RailSkeleton({ wide = false }: { wide?: boolean }) {
  const t = getT();
  return (
    <ContentRail wide={wide} placeholder>
      {/* The grey bars say nothing to a screen reader; this does. */}
      <p role="status" className="sr-only">
        {t.panel.loading}
      </p>
      <div aria-hidden className="animate-pulse px-6 pt-6 pb-10">
        <div className="h-40 w-full rounded-xl bg-[var(--color-line)]" />
        <div className="mt-5 h-7 w-2/3 rounded bg-[var(--color-line)]" />
        <div className="mt-2.5 h-4 w-1/2 rounded bg-[var(--color-line)]" />
        <div className="mt-6 space-y-2">
          <div className="h-3 w-full rounded bg-[var(--color-line)]" />
          <div className="h-3 w-full rounded bg-[var(--color-line)]" />
          <div className="h-3 w-4/5 rounded bg-[var(--color-line)]" />
        </div>
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i}>
              <div className="h-6 w-20 rounded bg-[var(--color-line)]" />
              <div className="mt-2 h-3 w-24 rounded bg-[var(--color-line)]" />
            </div>
          ))}
        </div>
      </div>
    </ContentRail>
  );
}
