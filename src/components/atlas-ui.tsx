import Link from "next/link";
import type { ReactNode } from "react";

export function TaglinePill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block rounded-full border border-[var(--color-line)] px-3.5 py-1.5 text-[11.5px] text-[var(--color-ink-muted)]">
      {children}
    </span>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block rounded-full bg-[#1b2233] px-3 py-1 text-[10.5px] font-medium uppercase tracking-[0.12em] text-white/85">
      {children}
    </span>
  );
}

export function NewsBadge({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-ink-muted)]">
      <span className="h-2 w-2 rounded-full bg-[var(--color-live)]" />
      {count} {count === 1 ? "news item" : "news items"} published
    </span>
  );
}

export function PrimaryButton({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded-full bg-[var(--color-accent)] px-6 py-2.5 text-[13px] font-medium text-white transition hover:bg-[var(--color-accent-strong)]"
    >
      {children}
    </Link>
  );
}

export function GhostButton({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded-full border border-[var(--color-line)] px-5 py-2.5 text-[13px] font-medium text-[var(--color-ink)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
    >
      {children}
    </Link>
  );
}

/** Ikony k datovým ukazatelům na kartě země (Figma: outline, 1.6px). */
export function StatIcon({ id }: { id: string }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (id) {
    case "hdi":
      return (
        <svg {...common} aria-hidden>
          <path d="M4 20V10M9 20V5M14 20v-7M19 20V8" />
          <path d="M3 20h18" />
        </svg>
      );
    case "life-expectancy":
      return (
        <svg {...common} aria-hidden>
          <path d="M20.8 8.6a4.9 4.9 0 0 0-8.8-2.9 4.9 4.9 0 0 0-8.8 2.9c0 5 8.8 10.4 8.8 10.4s8.8-5.4 8.8-10.4Z" />
        </svg>
      );
    case "gdp-per-capita":
      return (
        <svg {...common} aria-hidden>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7v10M14.6 9.4A2.8 2.8 0 0 0 12 8.2c-1.6 0-2.6.8-2.6 1.9 0 2.6 5.2 1.4 5.2 4 0 1.2-1.1 2-2.6 2a2.9 2.9 0 0 1-2.7-1.3" />
        </svg>
      );
    case "political-regime":
    case "democracy-index":
      return (
        <svg {...common} aria-hidden>
          <path d="M4 20h16M6 20V9M10 20V9M14 20V9M18 20V9M3.5 9 12 4l8.5 5" />
        </svg>
      );
    case "corruption":
      return (
        <svg {...common} aria-hidden>
          <path d="M12 3 4.5 6v6c0 4.3 3.2 7.6 7.5 9 4.3-1.4 7.5-4.7 7.5-9V6L12 3Z" />
          <path d="m9.5 12 1.8 1.8 3.6-3.6" />
        </svg>
      );
    case "extreme-poverty":
      return (
        <svg {...common} aria-hidden>
          <circle cx="12" cy="7" r="3" />
          <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
        </svg>
      );
    case "co2-per-capita":
      return (
        <svg {...common} aria-hidden>
          <path d="M5 16a3.5 3.5 0 0 1 .6-6.9 5 5 0 0 1 9.6-1.3A4 4 0 0 1 19 16H5Z" />
          <path d="M8 20h8" />
        </svg>
      );
    case "internet-users":
      return (
        <svg {...common} aria-hidden>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M3.5 12h17M12 3.5c2.2 2.4 3.3 5.3 3.3 8.5S14.2 18.1 12 20.5c-2.2-2.4-3.3-5.3-3.3-8.5S9.8 5.9 12 3.5Z" />
        </svg>
      );
    default:
      return (
        <svg {...common} aria-hidden>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 8v5M12 16h.01" />
        </svg>
      );
  }
}
