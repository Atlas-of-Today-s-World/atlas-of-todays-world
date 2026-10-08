"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { ADMIN_NAV } from "@/config/admin-nav";
import { cn } from "@/lib/cn";

/**
 * Admin side menu; the server filters items by permissions. Below `md` it is a
 * strip that scrolls sideways: its edges fade out (so it is clear there is more)
 * and the current section is scrolled into the middle on arrival.
 */
export function AdminNav({ allowed }: { allowed: string[] }) {
  const pathname = usePathname();
  const nav = useRef<HTMLElement>(null);
  const items = ADMIN_NAV.filter((item) => allowed.includes(item.href));

  useEffect(() => {
    const strip = nav.current;
    const current = strip?.querySelector<HTMLElement>('[aria-current="page"]');
    // Only the horizontal strip scrolls; the desktop column must not move the page.
    if (!strip || !current || strip.scrollWidth <= strip.clientWidth) return;
    strip.scrollLeft = current.offsetLeft - (strip.clientWidth - current.offsetWidth) / 2;
  }, [pathname]);

  return (
    <nav
      ref={nav}
      aria-label="Administration"
      // relative: the items' offsetLeft is measured from the strip.
      className="relative flex [scrollbar-width:none] gap-1 overflow-x-auto [mask-image:linear-gradient(90deg,transparent,#000_1rem,#000_calc(100%-1rem),transparent)] px-2 md:flex-col md:[mask-image:none] md:px-0"
    >
      {items.map((item) => {
        const active =
          item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-(--touch-min) shrink-0 items-center gap-2.5 rounded-lg px-3 text-[13.5px] whitespace-nowrap transition",
              active
                ? "bg-[var(--color-accent-soft)] font-medium text-[var(--color-accent-strong)]"
                : "text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/40",
            )}
          >
            <Icon size={17} aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
