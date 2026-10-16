/**
 * Placeholder of a full-width article while it loads (a topic, a global
 * issue): the photo header and a row of subtopic tiles. The frame around it
 * is the FullPage layout's.
 */
export function FullPageSkeleton() {
  return (
    <div aria-busy="true" className="animate-pulse">
      <div className="h-64 bg-[var(--color-line)]/50 sm:h-80" />
      <div className="pl-clear-globe-6xl mx-auto max-w-6xl px-4 py-10 sm:pr-8">
        <div className="h-4 w-48 rounded bg-[var(--color-line)]/60" />
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="aspect-[3/5] rounded-xl bg-[var(--color-line)]/60" />
          ))}
        </div>
      </div>
    </div>
  );
}
