/** Placeholder of a full-width entry while it loads (the frame is the layout's). */
export default function Loading() {
  return (
    <div aria-busy="true" className="animate-pulse">
      <div className="h-64 bg-[var(--color-line)]/50 sm:h-80" />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
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
