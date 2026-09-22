"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import NewsletterForm from "./NewsletterForm";

/**
 * Hlavička nad mapou.
 *
 * Zadání chce krátké menu: Map, About, Atlas Patrons, přepínač jazyka a odkazy
 * na sítě. Na mobilu se z toho stává hamburger, protože nad globusem není místo
 * a logo tam má zabírat co nejmíň. Když je vpravo otevřený bílý panel, navigace
 * se odsune doleva – jinak by bílý text zmizel na bílém pozadí.
 */
const NAV = [
  { href: "/", label: "Map" },
  { href: "/about", label: "About" },
  { href: "/patrons", label: "Atlas Patrons", primary: true },
];

const SOCIALS = [
  { href: "https://www.instagram.com/atlasoftodaysworld_official/", label: "Instagram", icon: "IG" },
  { href: "https://www.linkedin.com/company/atlas-of-todays-world/", label: "LinkedIn", icon: "in" },
  { href: "https://www.facebook.com/atlasoftodaysworld/", label: "Facebook", icon: "f" },
  { href: "https://bsky.app/profile/atlas-otw.bsky.social", label: "Bluesky", icon: "bs" },
];

export default function Header() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const wideRail = /^\/(news|region|global-issue)\//.test(pathname);
  const railOpen = pathname !== "/";

  // Panel se otevírá přes celou obrazovku, takže pod ním nesmí nic rolovat.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const navOffset = wideRail
    ? "md:right-[calc(min(52vw,46rem)+1.25rem)]"
    : railOpen
      ? "md:right-[calc(min(38vw,27rem)+1.25rem)]"
      : "md:right-7";

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-40 px-4 py-3 sm:px-7 sm:py-4">
      <Link
        href="/"
        className="pointer-events-auto inline-block rounded-[6px] border border-white/70 bg-white px-2.5 py-1 font-display text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#0d1324] shadow-lg shadow-black/30 sm:px-3.5 sm:py-2 sm:text-[13px]"
        aria-label="Atlas of Today's World — home"
      >
        {/* Na mobilu jen značka: plný název zabíral polovinu šířky obrazovky. */}
        <span className="sm:hidden">Atlas</span>
        <span className="hidden sm:inline">Atlas of Today&rsquo;s World</span>
      </Link>

      {/* Desktop */}
      <nav
        aria-label="Main"
        className={`pointer-events-auto absolute top-5 hidden items-center gap-6 text-sm text-white/90 ${
          wideRail ? "xl:flex" : "md:flex"
        } ${navOffset}`}
      >
        {NAV.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={
              item.primary
                ? "rounded-md border border-white/70 px-3.5 py-1.5 transition hover:bg-white hover:text-[#0d1324]"
                : "transition hover:text-white"
            }
          >
            {item.label}
          </Link>
        ))}
        <span className="flex items-center gap-2 text-white/60">
          {SOCIALS.map((social) => (
            <a
              key={social.label}
              href={social.href}
              target="_blank"
              rel="noreferrer"
              aria-label={social.label}
              className="grid h-7 w-7 place-items-center rounded-full border border-white/25 text-[10px] font-semibold transition hover:border-white/70 hover:text-white"
            >
              {social.icon}
            </a>
          ))}
        </span>
        <button
          type="button"
          className="cursor-default text-white/70"
          aria-label="Language: English"
          title="More languages are coming"
        >
          EN
        </button>
        <Link
          href="/admin"
          className="text-white/45 transition hover:text-white"
          title="Mock administration"
          aria-label="Administration"
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
            <path d="M10.13 5.88L10.21 3.59L13.79 3.59L13.87 5.88A6.4 6.4 0 0 1 15.00 6.35L16.68 4.79L19.21 7.32L17.65 9.00A6.4 6.4 0 0 1 18.12 10.13L20.41 10.21L20.41 13.79L18.12 13.87A6.4 6.4 0 0 1 17.65 15.00L19.21 16.68L16.68 19.21L15.00 17.65A6.4 6.4 0 0 1 13.87 18.12L13.79 20.41L10.21 20.41L10.13 18.12A6.4 6.4 0 0 1 9.00 17.65L7.32 19.21L4.79 16.68L6.35 15.00A6.4 6.4 0 0 1 5.88 13.87L3.59 13.79L3.59 10.21L5.88 10.13A6.4 6.4 0 0 1 6.35 9.00L4.79 7.32L7.32 4.79L9.00 6.35A6.4 6.4 0 0 1 10.13 5.88Z" />
            <circle cx="12" cy="12" r="3.1" />
          </svg>
        </Link>
      </nav>

      {/* Mobil */}
      <button
        type="button"
        onClick={() => setMenuOpen(true)}
        aria-label="Open menu"
        aria-expanded={menuOpen}
        className={`glass glass-hover pointer-events-auto absolute right-4 top-3 grid h-11 w-11 place-items-center rounded-full text-white ${
          wideRail ? "xl:hidden" : "md:hidden"
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M4 7h16M4 12h16M4 17h16"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {menuOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className="pointer-events-auto fixed inset-0 z-50 flex flex-col bg-[#0b101f]/97 px-6 py-5 text-white backdrop-blur"
        >
          <div className="flex items-center justify-between">
            <span className="font-display text-[11px] font-extrabold uppercase tracking-[0.14em]">
              Atlas of Today&rsquo;s World
            </span>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
              className="grid h-11 w-11 place-items-center rounded-full border border-white/25 text-white transition hover:border-white/70"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="m6 6 12 12M18 6 6 18"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          <nav aria-label="Main" className="mt-10 grid gap-1 text-[22px]">
            {NAV.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex min-h-14 items-center font-display font-bold"
              >
                {item.label}
              </Link>
            ))}
            <Link href="/news" className="flex min-h-14 items-center font-display font-bold">
              News
            </Link>
          </nav>

          <div className="mt-auto space-y-6 pb-2">
            <NewsletterForm />

            <div className="flex items-center gap-3">
              {SOCIALS.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={social.label}
                  className="grid h-11 w-11 place-items-center rounded-full border border-white/25 text-[12px] font-semibold"
                >
                  {social.icon}
                </a>
              ))}
              <span className="ml-auto text-[13px] text-white/60">EN</span>
              <Link href="/admin" className="text-[13px] text-white/45">
                Admin
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
