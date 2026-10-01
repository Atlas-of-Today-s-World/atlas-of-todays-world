"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocalizedRouter } from "@/components/i18n/useLocalizedRouter";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Link from "@/components/i18n/Link";
import { useMessages } from "@/components/i18n/LocaleProvider";

/**
 * Content panel next to the map. Holds the region profile, the country card and
 * whole news items – so the user never leaves the map.
 *
 * On desktop it's the right column, on mobile a bottom sheet; the content is rendered
 * only once so it isn't duplicated in the HTML.
 */
export default function ContentRail({
  children,
  /**
   * Where the close button goes back to. Defaults to the globe: the X should close
   * the panel, not open another – "one level up" is handled by the breadcrumbs.
   */
  closeHref = "/",
  wide = false,
  placeholder = false,
}: {
  children: ReactNode;
  closeHref?: string;
  wide?: boolean;
  /**
   * Skeleton from loading.tsx: no `id="content"` and `data-print`. While streaming,
   * the skeleton briefly sits in the DOM next to the real panel (hidden until revealed) —
   * with the same id the page would have two `#content` and print two panels.
   */
  placeholder?: boolean;
}) {
  const t = useMessages();
  const [collapsed, setCollapsed] = useState(false);
  const router = useLocalizedRouter();
  const panel = useRef<HTMLElement>(null);

  // The panel also closes with Esc – otherwise keyboard users couldn't get out of it.
  // Esc in a form field (search, newsletter) belongs to that field, not the panel.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true'], [role='dialog']")) {
        return;
      }
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
      tabIndex={-1}
      aria-label={t.panel.content}
      className={`pointer-events-auto absolute inset-x-0 bottom-0 z-20 max-h-[72dvh] overflow-hidden rounded-t-3xl bg-white text-[var(--color-ink)] shadow-[0_-8px_40px_rgba(0,0,0,0.45)] transition-transform duration-300 outline-none md:inset-x-auto md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:rounded-none md:shadow-[0_0_60px_rgba(0,0,0,0.45)] ${
        wide ? "md:w-(--rail-width-wide)" : "md:w-(--rail-width)"
      } ${collapsed ? "md:translate-x-full" : "md:translate-x-0"}`}
    >
      {/* Sheet handle on mobile */}
      <div className="flex justify-center py-2.5 md:hidden">
        <span className="h-1 w-10 rounded-full bg-[var(--color-line)]" />
      </div>

      {/* Panel collapse on desktop */}
      <button
        type="button"
        aria-label={collapsed ? t.panel.show : t.panel.hide}
        onClick={() => setCollapsed((value) => !value)}
        className="absolute top-1/2 -left-7 hidden h-14 w-7 -translate-y-1/2 items-center justify-center rounded-l-lg bg-[#1b2233] text-white/80 transition hover:bg-[#283148] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] md:flex"
      >
        {collapsed ? <ChevronLeft size={16} aria-hidden /> : <ChevronRight size={16} aria-hidden />}
      </button>

      {/* A link, not a button: closes the panel even before React hydrates. */}
      <Link
        href={closeHref}
        aria-label={t.common.close}
        data-print="hide"
        className="absolute top-2 right-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/85 text-[var(--color-ink-soft)] backdrop-blur transition hover:bg-[var(--color-line)] hover:text-[var(--color-ink)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-95 md:top-3"
      >
        <X size={18} strokeWidth={1.8} aria-hidden />
      </Link>

      <div className="panel-scroll max-h-[calc(72dvh-1.75rem)] overflow-y-auto overscroll-contain pb-6 md:h-full md:max-h-none md:pb-0">
        {children}
      </div>
    </aside>
  );
}
