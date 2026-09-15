"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/about", label: "About" },
  { href: "/", label: "Home" },
  { href: "/news", label: "News" },
];

/**
 * Hlavička nad mapou. Když je vpravo otevřený bílý panel, navigace se odsune
 * doleva – jinak by bílý text zmizel na bílém pozadí.
 */
export default function Header() {
  const pathname = usePathname();
  const wideRail = /^\/(news|region\/[^/]+\/full)/.test(pathname);
  const railOpen = pathname !== "/";

  const navOffset = wideRail
    ? "md:right-[calc(min(52vw,46rem)+1.25rem)]"
    : railOpen
      ? "md:right-[calc(min(38vw,27rem)+1.25rem)]"
      : "md:right-7";

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 px-5 py-4 sm:px-7">
      <Link
        href="/"
        className="pointer-events-auto inline-block rounded-[6px] border border-white/70 bg-white px-3.5 py-2 font-display text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#0d1324] shadow-lg shadow-black/30 sm:text-[13px]"
      >
        Atlas of Today&rsquo;s World
      </Link>

      <nav
        className={`pointer-events-auto absolute top-5 hidden items-center gap-7 text-sm text-white/90 ${
          wideRail ? "xl:flex" : "md:flex"
        } ${navOffset}`}
      >
        {NAV.map((item) => (
          <Link key={item.label} href={item.href} className="transition hover:text-white">
            {item.label}
          </Link>
        ))}
        <Link
          href="/admin"
          className="flex items-center gap-1.5 text-white/70 transition hover:text-white"
          title="Mock administrace novinek"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M10.01 6.23L9.93 3.04L14.07 3.04L13.99 6.23A6.1 6.1 0 0 1 15.27 6.85L17.72 4.79L20.30 8.03L17.75 9.96A6.1 6.1 0 0 1 18.06 11.35L21.20 11.98L20.28 16.01L17.18 15.22A6.1 6.1 0 0 1 16.29 16.33L17.75 19.18L14.02 20.97L12.71 18.06A6.1 6.1 0 0 1 11.29 18.06L9.98 20.97L6.25 19.18L7.71 16.33A6.1 6.1 0 0 1 6.82 15.22L3.72 16.01L2.80 11.98L5.94 11.35A6.1 6.1 0 0 1 6.25 9.96L3.70 8.03L6.28 4.79L8.73 6.85A6.1 6.1 0 0 1 10.01 6.23Z" />
            <circle cx="12" cy="12" r="3.1" />
          </svg>
          Admin
        </Link>
        <Link
          href="/support"
          className="rounded-md border border-white/70 px-3.5 py-1.5 transition hover:bg-white hover:text-[#0d1324]"
        >
          Support us
        </Link>
        <span className="cursor-default text-white/70">EN</span>
      </nav>
    </header>
  );
}
