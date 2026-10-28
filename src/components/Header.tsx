"use client";

import Link from "@/components/i18n/Link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Menu } from "lucide-react";
import { RAIL_OFFSET, isFullPage, isHome, railKind } from "@/config/layout";
import { activeItemId } from "@/features/navigation/active";
import type { Navigation } from "@/features/navigation/model";
import type { SocialLink } from "@/features/site/model";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { AccountMenu } from "./AccountMenu";
import { BrandLogo } from "./atlas/BrandLogo";
import { useMessages } from "./i18n/LocaleProvider";
import { FollowUs, MenuLink } from "./MenuLinks";

// The full-screen menu (with the newsletter form and Turnstile) is its own chunk:
// nothing shows it before the hamburger is pressed, so pages don't ship it up
// front. Pointing at or focusing the hamburger starts the download early.
const loadMenuDialog = () => import("./MenuDialog");
const MenuDialog = dynamic(loadMenuDialog);
const preloadMenuDialog = () => void loadMenuDialog();

/**
 * The one site header, in two looks:
 * - the home map: transparent, only the logo and buttons over the globe, so the
 *   globe gets as much room as possible (navigation moves left of an open panel);
 * - everywhere else (`bar`, or any other map page): a dark bar with the logo,
 *   "Back to Atlas" in the middle and the menu as buttons on the right.
 * On narrow screens the menu becomes a full-screen dialog behind a hamburger.
 * The person icon (all three places) opens the account menu (AccountMenu),
 * which asks who is signed in only then — the header itself never reads the session.
 * The menus come from Admin → Site menus and the social links ("Follow us",
 * FollowUs) from Admin → Site settings (`nav`, `socials`: read on the server,
 * `nav` already filtered by the feature switches — News shows only while
 * news_menu is on).
 */
export default function Header({
  newsletter = true,
  captcha,
  bar = false,
  nav,
  socials,
}: {
  newsletter?: boolean;
  /** The menu's newsletter form shows Turnstile (`captchaEnabled()`, read on the server). */
  captcha: boolean;
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

  // The open menu lives inside the header, whose layer caps its own: the header
  // rises with it, or the floating Newsletter / Support buttons sat on top of it.
  const layer = menuOpen ? "z-overlay" : "z-header";

  const menuDialog = menuOpen ? (
    <MenuDialog
      nav={nav}
      active={active}
      newsletter={newsletter}
      captcha={captcha}
      socials={socials}
      onClose={() => setMenuOpen(false)}
    />
  ) : null;

  if (bar || !isHome(pathname)) {
    return (
      <header
        data-print="hide"
        className={cn(
          "bg-[var(--color-space-deep)] text-white",
          layer,
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
            {/* "Follow us" waits for xl: at lg it squeezed the logo. */}
            <FollowUs
              socials={socials}
              label={t.header.followUs}
              className="hidden bg-white/10 xl:flex"
            />
            <AccountMenu look="bar" />
          </nav>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            onPointerEnter={preloadMenuDialog}
            onFocus={preloadMenuDialog}
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
      className={cn(
        "pointer-events-none absolute inset-x-0 top-0 px-4 py-3 sm:px-7 sm:py-4",
        layer,
      )}
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
        "Follow us" group drops its label below xl to fit. A shadow keeps the white
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
        <FollowUs
          socials={socials}
          label={t.header.followUs}
          className="glass [text-shadow:none]"
        />
        <AccountMenu look="globe" />
      </nav>

      {/* Mobil */}
      <button
        type="button"
        onClick={() => setMenuOpen(true)}
        onPointerEnter={preloadMenuDialog}
        onFocus={preloadMenuDialog}
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
