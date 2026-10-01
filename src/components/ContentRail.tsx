"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocalizedRouter } from "@/components/i18n/useLocalizedRouter";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

/**
 * Panel s obsahem vedle mapy. Nese profil regionu, kartu země i celé
 * novinku – uživatel tak nikdy neopustí mapu.
 *
 * Na desktopu je to pravý sloupec, na mobilu spodní sheet; obsah se renderuje
 * jen jednou, aby se v HTML neduplikoval.
 */
export default function ContentRail({
  children,
  /**
   * Kam se vrátit křížkem. Výchozí je globus: křížek má panel zavřít, ne
   * otevřít jiný – o cestu "o úroveň výš" se stará drobečková navigace.
   */
  closeHref = "/",
  wide = false,
}: {
  children: ReactNode;
  closeHref?: string;
  wide?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const router = useLocalizedRouter();
  const panel = useRef<HTMLElement>(null);

  // Panel se zavírá i klávesou Esc – jinak by se z něj klávesnicí nešlo dostat.
  // Esc v poli formuláře (hledání, newsletter) patří tomu poli, ne panelu.
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

  // Po otevření patří ohnisko do panelu, ať čtečka i klávesnice pokračují tam,
  // kde přibyl obsah, a ne na začátku stránky.
  useEffect(() => {
    panel.current?.focus({ preventScroll: true });
  }, []);

  return (
    <aside
      ref={panel}
      id="content"
      tabIndex={-1}
      aria-label="Content panel"
      className={`pointer-events-auto absolute inset-x-0 bottom-0 z-20 max-h-[72dvh] overflow-hidden rounded-t-3xl bg-white text-[var(--color-ink)] shadow-[0_-8px_40px_rgba(0,0,0,0.45)] transition-transform duration-300 outline-none md:inset-x-auto md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:rounded-none md:shadow-[0_0_60px_rgba(0,0,0,0.45)] ${
        wide ? "md:w-(--rail-width-wide)" : "md:w-(--rail-width)"
      } ${collapsed ? "md:translate-x-full" : "md:translate-x-0"}`}
    >
      {/* Úchyt sheetu na mobilu */}
      <div className="flex justify-center py-2.5 md:hidden">
        <span className="h-1 w-10 rounded-full bg-[var(--color-line)]" />
      </div>

      {/* Sbalení panelu na desktopu */}
      <button
        type="button"
        aria-label={collapsed ? "Show panel" : "Hide panel"}
        onClick={() => setCollapsed((value) => !value)}
        className="absolute top-1/2 -left-7 hidden h-14 w-7 -translate-y-1/2 items-center justify-center rounded-l-lg bg-[#1b2233] text-white/80 transition hover:bg-[#283148] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] md:flex"
      >
        {collapsed ? <ChevronLeft size={16} aria-hidden /> : <ChevronRight size={16} aria-hidden />}
      </button>

      <button
        type="button"
        aria-label="Close"
        onClick={() => router.push(closeHref)}
        className="absolute top-2 right-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/85 text-[var(--color-ink-soft)] backdrop-blur transition hover:bg-[var(--color-line)] hover:text-[var(--color-ink)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-95 md:top-3"
      >
        <X size={18} strokeWidth={1.8} aria-hidden />
      </button>

      <div className="panel-scroll max-h-[calc(72dvh-1.75rem)] overflow-y-auto overscroll-contain pb-6 md:h-full md:max-h-none md:pb-0">
        {children}
      </div>
    </aside>
  );
}
