"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocalizedRouter } from "@/components/i18n/useLocalizedRouter";
import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";
import { MOBILE_SHEET } from "@/config/layout";
import { cn } from "@/lib/cn";
import { belongsToField } from "@/lib/keyboard";
import { useScrollMemory } from "@/lib/use-scroll-memory";
import Link from "@/components/i18n/Link";
import { useMessages } from "@/components/i18n/LocaleProvider";

/**
 * Content panel next to the map. Holds the region profile, the country card and
 * whole news items – so the user never leaves the map.
 *
 * On desktop it's the right column, on mobile a bottom sheet; the content is rendered
 * only once so it isn't duplicated in the HTML. The sheet opens at a little over
 * half the window (the place stays visible above it); its handle expands it to
 * nearly full height — a tap, or a swipe up; a swipe down shrinks it back, and
 * from its opening height closes the panel (like the X).
 */
/** How far a finger must travel on the sheet handle to count as a swipe. */
const SWIPE_MIN_PX = 24;

export default function ContentRail({
  children,
  /**
   * Where the close button goes back to. Defaults to the globe: the X should close
   * the panel, not open another – "one level up" is handled by the breadcrumbs.
   */
  closeHref = "/",
  wide = false,
  fullPage,
  placeholder = false,
  collapsible = true,
}: {
  children: ReactNode;
  closeHref?: string;
  wide?: boolean;
  /**
   * The same place full width (`routes.countryFull`…): a preview in the panel
   * gets a "Full page view" button at its top.
   */
  fullPage?: string;
  /**
   * Skeleton from loading.tsx: no `id="content"` and `data-print`. While streaming,
   * the skeleton briefly sits in the DOM next to the real panel (hidden until revealed) —
   * with the same id the page would have two `#content` and print two panels.
   */
  placeholder?: boolean;
  /** Desktop tab on the panel's left edge that slides the panel away. */
  collapsible?: boolean;
}) {
  const t = useMessages();
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  // Where a swipe on the handle started; a swipe also ends in a click, which it swallows.
  const swipeFrom = useRef<number | null>(null);
  const swiped = useRef(false);
  const router = useLocalizedRouter();
  const panel = useRef<HTMLElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  // Back to a panel returns to where it was read; the skeleton stays out of it.
  useScrollMemory(scroller, !placeholder);

  // The panel also closes with Esc – otherwise keyboard users couldn't get out of it.
  // Esc in a form field (search, newsletter) belongs to that field, not the panel.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || belongsToField(event)) return;
      // An open dialog (the menu) takes Esc for itself, wherever focus is.
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      router.push(closeHref);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeHref, router]);

  // On open, focus moves into the panel so screen readers and keyboard continue where
  // the content appeared, not at the top of the page.
  useEffect(() => {
    panel.current?.focus({ preventScroll: true });
  }, []);

  return (
    <aside
      ref={panel}
      id={placeholder ? undefined : "content"}
      data-print={placeholder ? undefined : "content"}
      aria-busy={placeholder || undefined}
      // On phones the cookie notice moves out of the bottom sheet's way (globals.css).
      data-content-rail=""
      data-sheet={expanded ? "expanded" : undefined}
      tabIndex={-1}
      aria-label={t.panel.content}
      className={cn(
        "z-panel pointer-events-auto absolute inset-x-0 bottom-0 rounded-t-3xl bg-white text-[var(--color-ink)] shadow-[0_-8px_40px_rgba(0,0,0,0.45)] transition-[transform,max-height] duration-300 outline-none md:inset-x-auto md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:rounded-none md:shadow-[0_0_60px_rgba(0,0,0,0.45)]",
        expanded ? MOBILE_SHEET.expandedClassName : MOBILE_SHEET.className,
        wide ? "md:w-(--rail-width-wide)" : "md:w-(--rail-width)",
        collapsed ? "md:translate-x-full" : "md:translate-x-0",
      )}
    >
      {/* Sheet handle on mobile: tap or swipe to expand / shrink the sheet. */}
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={expanded ? t.panel.shrink : t.panel.expand}
        onClick={() => {
          if (swiped.current) swiped.current = false;
          else setExpanded((value) => !value);
        }}
        onPointerDown={(event) => {
          swipeFrom.current = event.clientY;
          swiped.current = false;
        }}
        onPointerUp={(event) => {
          const from = swipeFrom.current;
          swipeFrom.current = null;
          if (from === null || Math.abs(event.clientY - from) < SWIPE_MIN_PX) return;
          swiped.current = true;
          if (event.clientY < from) setExpanded(true);
          else if (expanded) setExpanded(false);
          else router.push(closeHref);
        }}
        className="flex h-(--touch-min) w-full touch-none items-center justify-center focus-visible:outline-none md:hidden [&:focus-visible>span]:bg-[var(--color-accent)]"
      >
        <span aria-hidden className="h-1.5 w-12 rounded-full bg-[var(--color-line)]" />
      </button>

      {/*
        Panel collapse on desktop: a tab on the panel's left edge. The aside doesn't
        clip (no overflow-hidden), so the tab stays visible next to the panel — and,
        once collapsed, at the window's right edge to bring the panel back. It sits low,
        above the floating buttons: the controls over the map (mode switch, global
        issues list, search) grow down from the top and covered it mid-height.
      */}
      {collapsible ? (
        <button
          type="button"
          aria-label={collapsed ? t.panel.show : t.panel.hide}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((value) => !value)}
          className="absolute bottom-32 -left-(--touch-min) hidden h-14 w-(--touch-min) items-center justify-center rounded-l-xl bg-[var(--color-space-raised)] text-white/80 shadow-[-4px_0_16px_rgba(0,0,0,0.35)] transition hover:bg-[var(--color-space-raised-hover)] hover:text-white focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none md:flex"
        >
          {collapsed ? (
            <ChevronLeft size={16} aria-hidden />
          ) : (
            <ChevronRight size={16} aria-hidden />
          )}
        </button>
      ) : null}

      {/* A link, not a button: closes the panel even before React hydrates. */}
      <Link
        href={closeHref}
        aria-label={t.common.close}
        data-print="hide"
        className="absolute top-2 right-3 z-10 flex size-(--touch-min) items-center justify-center rounded-full bg-white/85 text-[var(--color-ink-soft)] backdrop-blur transition hover:bg-[var(--color-line)] hover:text-[var(--color-ink)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-95 md:top-3"
      >
        <X size={18} strokeWidth={1.8} aria-hidden />
      </Link>

      <div
        ref={scroller}
        // Collapsed off-screen on desktop: out of the Tab and reading order.
        inert={collapsed || undefined}
        className={cn(
          // The aside doesn't clip (that hid the collapse tab), so this does:
          // a too-wide child never scrolls the panel sideways.
          "panel-scroll overflow-x-hidden overflow-y-auto overscroll-contain pb-6 md:h-full md:max-h-none md:pb-0",
          expanded ? MOBILE_SHEET.expandedScrollClassName : MOBILE_SHEET.scrollClassName,
        )}
      >
        {fullPage ? (
          // Its own row at the top (not floating): it must never cover a
          // breadcrumb or a title. The close button keeps the right corner.
          // Prefetched on intent: the full page is rendered on first visit and
          // brings the full-width layout's own scripts, which a reader of the
          // preview mostly never needs.
          <div data-print="hide" className="flex px-5 pt-3 pr-16 md:pt-3">
            <Link
              href={fullPage}
              prefetchOnIntent
              className="inline-flex min-h-(--touch-min) items-center gap-2 rounded-full border border-[var(--color-line)] bg-white px-4 text-[13px] font-medium text-[var(--color-ink)] transition hover:border-[var(--color-ink-muted)] hover:bg-[var(--color-paper)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none active:scale-95"
            >
              <Maximize2 size={15} strokeWidth={1.8} aria-hidden />
              {t.panel.fullPage}
            </Link>
          </div>
        ) : null}
        {children}
      </div>
    </aside>
  );
}
