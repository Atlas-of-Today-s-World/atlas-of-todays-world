"use client";

import Link from "@/components/i18n/Link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, UserRound, X } from "lucide-react";
import { RAIL_OFFSET, isFullPage, railKind } from "@/config/layout";
import { ACCOUNT_NAV, LEGAL_NAV, MAIN_NAV, SOCIALS } from "@/config/navigation";
import { useFocusTrap } from "@/lib/use-focus-trap";
import NewsletterForm from "./NewsletterForm";
import { BrandLogo } from "./atlas/BrandLogo";
import { useMessages } from "./i18n/LocaleProvider";

/**
 * Header over the map.
 *
 * The brief wants a short menu: Map, About, Atlas Patrons, language switcher and social
 * links. On mobile it becomes a hamburger, because there's no room above the globe
 * and the logo should take as little as possible. When the white panel is open on the right,
 * the navigation moves left – otherwise white text would vanish on a white background.
 */
export default function Header({ newsletter = true }: { newsletter?: boolean }) {
  const pathname = usePathname();
  const t = useMessages();
  // The menu is open only on the page where it was opened — navigating away closes it
  // without an effect (React Compiler: no setState in an effect).
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const menuOpen = menuPath === pathname;
  const setMenuOpen = (open: boolean) => setMenuPath(open ? pathname : null);
  const menu = useRef<HTMLDivElement>(null);
  useFocusTrap(menu, menuOpen);

  const rail = railKind(pathname);
  const wideRail = rail === "wide";

  // The panel opens full-screen, so nothing underneath may scroll.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuPath(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // Full-width pages bring their own header (FullPage).
  if (isFullPage(pathname)) return null;

  return (
    <header
      data-print="hide"
      className="pointer-events-none absolute inset-x-0 top-0 z-40 px-4 py-3 sm:px-7 sm:py-4"
    >
      <Link
        href="/"
        className="pointer-events-auto inline-flex min-h-11 items-center"
        aria-label={t.header.home}
      >
        <BrandLogo
          tone="light"
          className="h-[18px] drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)] sm:h-7"
        />
      </Link>

      {/* Desktop */}
      <nav
        aria-label={t.header.main}
        className={`pointer-events-auto absolute top-5 hidden items-center gap-6 text-sm text-white/90 ${
          wideRail ? "xl:flex" : "md:flex"
        } ${RAIL_OFFSET[rail]}`}
      >
        {MAIN_NAV.filter((item) => !item.compactHidden).map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={
              item.primary
                ? "rounded-md bg-[var(--color-patron)] px-3.5 py-1.5 font-medium text-white transition hover:bg-[var(--color-patron-strong)]"
                : "transition hover:text-white"
            }
          >
            {t.nav[item.key]}
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
        <Link
          href={ACCOUNT_NAV.href}
          className="grid min-h-11 min-w-11 place-items-center text-white/60 transition hover:text-white"
          title={t.header.accountTitle}
          aria-label={t.header.account}
        >
          <UserRound size={17} strokeWidth={1.6} aria-hidden />
        </Link>
      </nav>

      {/* Mobil */}
      <button
        type="button"
        onClick={() => setMenuOpen(true)}
        aria-label={t.header.openMenu}
        aria-expanded={menuOpen}
        className={`glass glass-hover pointer-events-auto absolute top-3 right-4 grid h-11 w-11 place-items-center rounded-full text-white ${
          wideRail ? "xl:hidden" : "md:hidden"
        }`}
      >
        <Menu size={18} strokeWidth={1.8} aria-hidden />
      </button>

      {menuOpen ? (
        <div
          ref={menu}
          role="dialog"
          aria-modal="true"
          aria-label={t.header.menu}
          className="pointer-events-auto fixed inset-0 z-50 flex flex-col bg-[#0b101f]/97 px-6 py-5 text-white backdrop-blur"
        >
          <div className="flex items-center justify-between">
            <BrandLogo tone="light" className="h-5" />
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label={t.header.closeMenu}
              className="grid h-11 w-11 place-items-center rounded-full border border-white/25 text-white transition hover:border-white/70"
            >
              <X size={18} strokeWidth={1.8} aria-hidden />
            </button>
          </div>

          <nav aria-label={t.header.main} className="mt-10 grid gap-1 text-[22px]">
            {MAIN_NAV.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className="font-display flex min-h-14 items-center font-bold"
              >
                {t.nav[item.key]}
              </Link>
            ))}
          </nav>

          <div className="mt-auto space-y-6 pb-2">
            {newsletter ? <NewsletterForm /> : null}

            <nav aria-label={t.header.legal} className="flex gap-4 text-[12.5px] text-white/60">
              {LEGAL_NAV.map((item) => (
                <Link key={item.href} href={item.href} className="flex min-h-11 items-center">
                  {t.nav[item.key]}
                </Link>
              ))}
            </nav>

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
              <Link
                href={ACCOUNT_NAV.href}
                className="ml-auto flex min-h-11 items-center text-[13px] text-white/60"
              >
                {t.nav[ACCOUNT_NAV.key]}
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
