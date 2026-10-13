"use client";

import Link from "@/components/i18n/Link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Menu, UserRound, X } from "lucide-react";
import { RAIL_OFFSET, isFullPage, isHome, railKind } from "@/config/layout";
import { ACCOUNT_NAV } from "@/config/navigation";
import { activeItemId } from "@/features/navigation/active";
import type { Navigation, NavLink } from "@/features/navigation/model";
import type { SocialLink } from "@/features/site/model";
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
 * The menus come from Admin → Site menus and the social badges from Admin →
 * Site settings (`nav`, `socials`: read on the server, `nav` already filtered by
 * the feature switches — News shows only while news_menu is on).
 */
export default function Header({
  newsletter = true,
  bar = false,
  nav,
  socials,
}: {
  newsletter?: boolean;
  /** Pages that render the header themselves (full-width pages, pages without the globe). */
  bar?: boolean;
  nav: Navigation;
  socials: readonly SocialLink[];
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

  const active = activeItemId([...nav.main, ...nav.legal], pathname);

  // Full-width pages render the bar themselves, inside their own scrolling frame.
  if (!bar && isFullPage(pathname)) return null;

  const menuDialog = menuOpen ? (
    <MenuDialog
      refObject={menu}
      nav={nav}
      active={active}
      newsletter={newsletter}
      socials={socials}
      onClose={() => setMenuOpen(false)}
    />
  ) : null;

  if (bar || !isHome(pathname)) {
    return (
      <header
        data-print="hide"
        className={cn(
          "z-header bg-[var(--color-space-deep)] text-white",
          bar ? "sticky top-0" : "absolute inset-x-0 top-0",
        )}
      >
        <div className="mx-auto grid h-16 max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 sm:px-8">
          <Link
            href="/"
            aria-label={t.header.home}
            className="flex min-h-(--touch-min) items-center justify-self-start"
          >
            <BrandLogo tone="light" className="h-5 sm:h-6" />
          </Link>

          {/* On phones a compact "← Atlas" (same accessible name), so the logo has room. */}
          <Link
            href="/"
            aria-label={t.topics.backToAtlas}
            className="flex min-h-(--touch-min) items-center gap-1.5 justify-self-center rounded-full border border-white/25 px-3 text-[12.5px] font-medium whitespace-nowrap transition hover:border-white/60 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none sm:gap-2 sm:px-4 sm:text-[13px]"
          >
            <ArrowLeft aria-hidden className="size-4" />
            <span className="sm:hidden">{t.topics.backToAtlasShort}</span>
            <span className="max-sm:hidden">{t.topics.backToAtlas}</span>
          </Link>

          <nav
            aria-label={t.header.main}
            className="hidden items-center gap-2 justify-self-end text-[13px] lg:flex"
          >
            {nav.main
              .filter((item) => item.href !== "/")
              .map((item) => (
                <MenuLink
                  key={item.id}
                  item={item}
                  active={item.id === active}
                  className={
                    item.primary
                      ? buttonVariants({ variant: "patron", size: "sm" })
                      : "flex min-h-(--touch-min) items-center rounded-md bg-white/10 px-3 font-medium whitespace-nowrap transition hover:bg-white/20"
                  }
                />
              ))}
          </nav>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label={t.header.openMenu}
            aria-expanded={menuOpen}
            className="grid size-(--touch-min) place-items-center justify-self-end rounded-full border border-white/25 text-white transition hover:border-white/60 lg:hidden"
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
      className="z-header pointer-events-none absolute inset-x-0 top-0 px-4 py-3 sm:px-7 sm:py-4"
    >
      <Link
        href="/"
        className="pointer-events-auto inline-flex min-h-(--touch-min) items-center"
        aria-label={t.header.home}
      >
        <BrandLogo
          tone="light"
          className="h-[18px] drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)] sm:h-7"
        />
      </Link>

      {/*
        Desktop: from lg up — below that the links ran over the logo (768 px). The
        social badges need still more room (and are small targets), so they wait
        for xl; they are in the mobile menu either way. A shadow keeps the white
        text readable over the light parts of the globe (Greenland, Sahara).
      */}
      <nav
        aria-label={t.header.main}
        className={`pointer-events-auto absolute top-3 hidden items-center gap-4 text-sm text-white/90 [text-shadow:0_1px_3px_rgba(0,0,0,0.8)] sm:top-4 xl:gap-6 ${
          wideRail ? "xl:flex" : "lg:flex"
        } ${RAIL_OFFSET[rail]}`}
      >
        {nav.main
          .filter((item) => !item.compactHidden)
          .map((item) => (
            <MenuLink
              key={item.id}
              item={item}
              active={item.id === active}
              className={
                item.primary
                  ? "flex min-h-(--touch-min) items-center rounded-full bg-[var(--color-patron)] px-4 font-medium whitespace-nowrap text-white transition [text-shadow:none] hover:bg-[var(--color-patron-strong)]"
                  : "flex min-h-(--touch-min) min-w-(--touch-min) items-center justify-center whitespace-nowrap transition hover:text-white"
              }
            />
          ))}
        <span className="hidden items-center gap-2 [text-shadow:none] xl:flex">
          <SocialLinks socials={socials} className="size-(--touch-min) text-[11px]" />
        </span>
        <Link
          href={ACCOUNT_NAV.href}
          className="grid min-h-(--touch-min) min-w-(--touch-min) place-items-center text-white/80 drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] transition hover:text-white"
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
        className={`glass glass-hover pointer-events-auto absolute top-3 right-4 grid size-(--touch-min) place-items-center rounded-full text-white ${
          wideRail ? "xl:hidden" : "lg:hidden"
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
  active,
  newsletter,
  socials,
  onClose,
}: {
  refObject: React.RefObject<HTMLDivElement | null>;
  nav: Navigation;
  /** Id of the current page's item, if any. */
  active: string | null;
  newsletter: boolean;
  socials: readonly SocialLink[];
  onClose: () => void;
}) {
  const t = useMessages();
  return (
    <div
      ref={refObject}
      role="dialog"
      aria-modal="true"
      aria-label={t.header.menu}
      className="z-overlay pointer-events-auto fixed inset-0 flex flex-col bg-[#0b101f]/97 px-6 py-5 text-white backdrop-blur"
    >
      <div className="flex items-center justify-between">
        <BrandLogo tone="light" className="h-5" />
        <button
          type="button"
          onClick={onClose}
          aria-label={t.header.closeMenu}
          className="grid size-(--touch-min) place-items-center rounded-full border border-white/25 text-white transition hover:border-white/70"
        >
          <X size={18} strokeWidth={1.8} aria-hidden />
        </button>
      </div>

      <nav aria-label={t.header.main} className="mt-10 grid gap-1 text-[22px]">
        {nav.main.map((item) => (
          <MenuLink
            key={item.id}
            item={item}
            active={item.id === active}
            className="font-display flex min-h-14 items-center font-bold"
          />
        ))}
      </nav>

      <div className="mt-auto space-y-6 pb-2">
        {newsletter ? <NewsletterForm /> : null}

        <nav aria-label={t.header.legal} className="flex gap-4 text-[12.5px] text-white/60">
          {nav.legal.map((item) => (
            <MenuLink
              key={item.id}
              item={item}
              active={item.id === active}
              className="flex min-h-(--touch-min) min-w-(--touch-min) items-center justify-center"
            />
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <SocialLinks socials={socials} className="size-(--touch-min) text-[12px]" />
          <Link
            href={ACCOUNT_NAV.href}
            className="ml-auto flex min-h-(--touch-min) min-w-(--touch-min) items-center justify-center text-[13px] whitespace-nowrap text-white/70"
          >
            {t.nav[ACCOUNT_NAV.key]}
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * One menu item (header, mobile menu and the footer of pages without the
 * globe). A path on this site goes through the i18n `Link`; an https://
 * address opens in a new tab. The current page gets `aria-current` (no visual change).
 */
export function MenuLink({
  item,
  active = false,
  className,
}: {
  item: NavLink;
  active?: boolean;
  className: string;
}) {
  return (
    <Link
      href={item.href}
      className={className}
      aria-current={active ? "page" : undefined}
      {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {item.label}
    </Link>
  );
}

/**
 * Social network links as round badges: white with dark letters, so they stand
 * out on the photo behind the home header as well as on the dark bar.
 */
function SocialLinks({
  socials,
  className,
}: {
  socials: readonly SocialLink[];
  className: string;
}) {
  return socials.map((social) => (
    <a
      key={social.href}
      href={social.href}
      target="_blank"
      rel="noreferrer"
      aria-label={social.label}
      className={cn(
        "grid place-items-center rounded-full bg-white font-bold text-[var(--color-ink)] shadow-sm transition hover:bg-[var(--color-accent)] hover:text-white focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none",
        className,
      )}
    >
      {social.icon}
    </a>
  ));
}
