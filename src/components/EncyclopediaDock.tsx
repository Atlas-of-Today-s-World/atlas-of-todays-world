"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import EncyclopediaPanel from "./EncyclopediaPanel";

/**
 * Na úvodní mapě je panel Global Encyclopedia rozbalený (jako ve Figmě),
 * nad profilem regionu nebo země se schová do skleněného tlačítka, aby
 * nepřekrýval obsah.
 */
export default function EncyclopediaDock() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [open, setOpen] = useState(false);
  const visible = isHome || open;

  return (
    <div className="pointer-events-none flex flex-col items-end gap-2">
      {!isHome ? (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="glass glass-hover pointer-events-auto flex items-center gap-2 rounded-full px-3.5 py-2 text-[12.5px] whitespace-nowrap text-white/90 transition"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
            <path
              d="m16 16 4 4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          {open ? "Close search" : "Search the Atlas"}
        </button>
      ) : null}

      {visible ? <EncyclopediaPanel /> : null}
    </div>
  );
}
