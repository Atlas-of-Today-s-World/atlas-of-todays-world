import ContentRail from "./ContentRail";

/**
 * Zobrazí se hned po kliknutí na globus, než dorazí obsah panelu.
 * Bez něj by se po kliknutí chvíli nedělo vůbec nic.
 */
export default function RailSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <ContentRail wide={wide} placeholder>
      <div className="animate-pulse px-6 pt-6 pb-10">
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
