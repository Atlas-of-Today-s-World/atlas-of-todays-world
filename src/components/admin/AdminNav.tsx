"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_NAV } from "@/config/admin-nav";
import { cn } from "@/lib/cn";

/** Boční menu administrace; položky filtruje server podle oprávnění. */
export function AdminNav({ allowed }: { allowed: string[] }) {
  const pathname = usePathname();
  const items = ADMIN_NAV.filter((item) => allowed.includes(item.href));
  return (
    <nav aria-label="Administration" className="flex gap-1 overflow-x-auto md:flex-col">
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
