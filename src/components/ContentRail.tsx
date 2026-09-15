"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

/**
 * Panel s obsahem vedle mapy. Nese profil regionu, kartu země i celé
 * novinku – uživatel tak nikdy neopustí mapu.
 *
 * Na desktopu je to pravý sloupec, na mobilu spodní sheet; obsah se renderuje
 * jen jednou, aby se v HTML neduplikoval.
 */
export default function ContentRail({
  children,
  /** Kam se vrátit křížkem. Výchozí je globus bez výběru. */
  closeHref = "/",
  wide = false,
}: {
  children: ReactNode;
  closeHref?: string;
  wide?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const router = useRouter();

  return (
    <aside
      className={`pointer-events-auto absolute inset-x-0 bottom-0 z-20 max-h-[72dvh] overflow-hidden rounded-t-3xl bg-white text-[var(--color-ink)] shadow-[0_-8px_40px_rgba(0,0,0,0.45)] transition-transform duration-300 md:inset-x-auto md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:rounded-none md:shadow-[0_0_60px_rgba(0,0,0,0.45)] ${
        wide ? "md:w-[min(52vw,46rem)]" : "md:w-[min(38vw,27rem)]"
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
        className="absolute -left-7 top-1/2 hidden h-14 w-7 -translate-y-1/2 items-center justify-center rounded-l-lg bg-[#1b2233] text-white/80 transition hover:bg-[#283148] md:flex"
      >
        <span aria-hidden>{collapsed ? "‹" : "›"}</span>
      </button>

      <button
        type="button"
        aria-label="Close"
        onClick={() => router.push(closeHref)}
        className="absolute right-4 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/85 text-lg text-[var(--color-ink-soft)] backdrop-blur transition hover:bg-[var(--color-line)] md:top-4"
      >
        ×
      </button>

      <div className="panel-scroll max-h-[calc(72dvh-1.75rem)] overflow-y-auto overscroll-contain pb-6 md:h-full md:max-h-none md:pb-0">
        {children}
      </div>
    </aside>
  );
}
