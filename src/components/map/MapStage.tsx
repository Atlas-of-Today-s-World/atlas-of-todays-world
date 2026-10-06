"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { isFullPage, isHome } from "@/config/layout";
import { cn } from "@/lib/cn";

/**
 * Area of the globe, its controls and the content panel. On the home map (and
 * under full-width pages) it fills the window behind the transparent header;
 * on every other map page it starts below the dark header bar.
 */
export function MapStage({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const underBar = !isHome(pathname) && !isFullPage(pathname);
  return (
    <div className={cn("absolute inset-x-0 bottom-0", underBar ? "top-16" : "top-0")}>
      {children}
    </div>
  );
}
