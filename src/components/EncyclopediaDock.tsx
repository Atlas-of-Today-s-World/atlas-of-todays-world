"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import EncyclopediaPanel from "./EncyclopediaPanel";

/**
 * Vyhledávání nad mapou.
 *
 * Na desktopu je na úvodní mapě rozbalené (jako ve Figmě). Na mobilu je vždycky
 * jen ikona, protože rozbalený panel by zakryl skoro celý globus – klepnutím se
 * otevře. Nad profilem regionu nebo země se schovává i na desktopu.
 */
export default function EncyclopediaDock() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [open, setOpen] = useState(false);

  return (
    <div className="pointer-events-none flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? "Close search" : "Search the Atlas"}
        className={`glass glass-hover pointer-events-auto flex h-11 items-center gap-2 rounded-full px-3.5 text-[12.5px] whitespace-nowrap text-white/90 transition ${
          isHome ? "md:hidden" : ""
        }`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <span className="hidden sm:inline">{open ? "Close search" : "Search the Atlas"}</span>
      </button>

      <div className={`${open ? "block" : "hidden"} ${isHome ? "md:block" : ""}`}>
        <EncyclopediaPanel />
      </div>
    </div>
  );
}
