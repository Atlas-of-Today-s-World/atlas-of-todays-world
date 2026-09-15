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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" stroke="currentColor" strokeWidth="1.6" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.94-1.16l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 3 15a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.16-2.94l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 5a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.94 1.16l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 21 11a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" stroke="currentColor" strokeWidth="1.4" />
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
