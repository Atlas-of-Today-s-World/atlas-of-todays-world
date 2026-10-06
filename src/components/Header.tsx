"use client";

import Link from "@/components/i18n/Link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Menu, UserRound, X } from "lucide-react";
import { RAIL_OFFSET, isFullPage, isHome, railKind } from "@/config/layout";
import { ACCOUNT_NAV, LEGAL_NAV, SOCIALS, mainNav } from "@/config/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { useFocusTrap } from "@/lib/use-focus-trap";
import NewsletterForm from "./NewsletterForm";
import { BrandLogo } from "./atlas/BrandLogo";
import { useMessages } from "./i18n/LocaleProvider";

/**
 * The one site header, in two looks:
 * - the home map: transparent, only the logo and buttons over the globe, so the
 *   globe gets as much room as possible (navigation moves left of an open panel);
 * - everywhere else (`bar`, or any other map page): a dark bar with the logo,
 *   "Back to Atlas" in the middle and the menu as buttons on the right.
 * On narrow screens the menu becomes a full-screen dialog behind a hamburger.
 * News is in the menu only while it is switched on (`showNews`, flag news_menu).
 */
export default function Header({
  newsletter = true,
  showNews = false,
  bar = false,
}: {
  newsletter?: boolean;
  showNews?: boolean;
  /** Pages that render the header themselves (full-width pages, pages without the globe). */
  bar?: boolean;
}) {
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

  const nav = mainNav({ news: showNews });

  // Full-width pages render the bar themselves, inside their own scrolling frame.
  if (!bar && isFullPage(pathname)) return null;

  const menuDialog = menuOpen ? (
    <MenuDialog
      refObject={menu}
      nav={nav}
      newsletter={newsletter}
      onClose={() => setMenuOpen(false)}
    />
  ) : null;

  if (bar || !isHome(pathname)) {
    return (
      <header
        data-print="hide"
        className={cn(
          "z-40 bg-[var(--color-space-deep)] text-white",
          bar ? "sticky top-0" : "absolute inset-x-0 top-0",
        )}
      >
        <div className="mx-auto grid h-16 max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 sm:px-8">
          <Link
            href="/"
            aria-label={t.header.home}
            className="flex min-h-11 items-center justify-self-start"
          >
            <BrandLogo tone="light" className="h-[18px] sm:h-6" />
          </Link>

          <Link
            href="/"
            className="flex min-h-11 items-center gap-2 justify-self-center rounded-full border border-white/25 px-4 text-[13px] font-medium whitespace-nowrap transition hover:border-white/60 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none"
          >
            <ArrowLeft aria-hidden className="size-4" />
            {t.topics.backToAtlas}
          </Link>

          <nav
            aria-label={t.header.main}
            className="hidden items-center gap-2 justify-self-end text-[13px] lg:flex"
          >
            {nav
              .filter((item) => item.href !== "/")
              .map((item) =>
                item.primary ? (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={buttonVariants({ variant: "patron", size: "sm" })}
                  >
                    {t.nav[item.key]}
                  </Link>
                ) : (
                  <Link
                    key={item.key}
                    href={item.href}
                    className="flex min-h-9 items-center rounded-md bg-white/10 px-3 font-medium transition hover:bg-white/20"
                  >
                    {t.nav[item.key]}
                  </Link>
                ),
              )}
          </nav>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label={t.header.openMenu}
            aria-expanded={menuOpen}
            className="grid h-11 w-11 place-items-center justify-self-end rounded-full border border-white/25 text-white transition hover:border-white/60 lg:hidden"
          >
            <Menu size={18} strokeWidth={1.8} aria-hidden />
          </button>
        </div>
        {menuDialog}
      </header>
    );
  }

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
        {nav
          .filter((item) => !item.compactHidden)
          .map((item) => (
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

      {menuDialog}
    </header>
  );
}

/** The full-screen menu on narrow screens (both header looks). */
function MenuDialog({
  refObject,
  nav,
  newsletter,
  onClose,
}: {
  refObject: React.RefObject<HTMLDivElement | null>;
  nav: ReturnType<typeof mainNav>;
  newsletter: boolean;
  onClose: () => void;
}) {
  const t = useMessages();
  return (
    <div
      ref={refObject}
      role="dialog"
      aria-modal="true"
      aria-label={t.header.menu}
      className="pointer-events-auto fixed inset-0 z-50 flex flex-col bg-[#0b101f]/97 px-6 py-5 text-white backdrop-blur"
    >
      <div className="flex items-center justify-between">
        <BrandLogo tone="light" className="h-5" />
        <button
          type="button"
          onClick={onClose}
          aria-label={t.header.closeMenu}
          className="grid h-11 w-11 place-items-center rounded-full border border-white/25 text-white transition hover:border-white/70"
        >
          <X size={18} strokeWidth={1.8} aria-hidden />
        </button>
      </div>

      <nav aria-label={t.header.main} className="mt-10 grid gap-1 text-[22px]">
        {nav.map((item) => (
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
            <Link key={item.key} href={item.href} className="flex min-h-11 items-center">
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
  );
}
