import { cn } from "@/lib/cn";

/**
 * Credit for the website's builder, Develogi.cz s.r.o.: a line of text and
 * the logo linking to develogi.cz. The same on the Patrons page and on About;
 * the texts come from the caller's messages (`patrons.builtWith*`).
 */
export function DevelogiCredit({
  text,
  label,
  className,
}: {
  text: string;
  label: string;
  className?: string;
}) {
  return (
    <aside
      aria-label={label}
      className={cn("flex flex-wrap items-center justify-center gap-x-4 gap-y-2", className)}
    >
      <p className="m-0 text-[13px] text-[var(--color-ink-soft)]">{text}</p>
      <a
        href="https://develogi.cz"
        target="_blank"
        rel="noopener"
        className="inline-flex min-h-11 items-center rounded-md px-1 transition hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- small static logo, no optimizer (next.config) */}
        <img
          src="/brand/develogi-logo-dark.png"
          alt="Develogi.cz"
          width={155}
          height={24}
          loading="lazy"
          className="m-0 h-6 w-auto"
        />
      </a>
    </aside>
  );
}
