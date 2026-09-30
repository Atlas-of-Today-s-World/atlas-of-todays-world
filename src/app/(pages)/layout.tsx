import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { ACCOUNT_NAV, MAIN_NAV } from "@/config/navigation";

/** Jednoduchý světlý layout pro stránky mimo mapu (About, News, Support). */
export default function PagesLayout({ children }: { children: React.ReactNode }) {
  const links = [...MAIN_NAV.filter((item) => !item.primary), ACCOUNT_NAV];
  const cta = MAIN_NAV.find((item) => item.primary);

  return (
    <div className="min-h-dvh bg-white text-[var(--color-ink)]">
      <header className="border-b border-[var(--color-line)]">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <Link
            href="/"
            className="font-display rounded-[6px] border border-[#0d1324] px-3 py-1.5 text-[11px] font-extrabold tracking-[0.14em] uppercase"
          >
            Atlas of Today&rsquo;s World
          </Link>
          <nav
            aria-label="Main"
            className="flex flex-wrap items-center gap-x-5 text-[13px] text-[var(--color-ink-soft)]"
          >
            {links.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-h-11 items-center hover:text-[var(--color-accent)]"
              >
                {item.label}
              </Link>
            ))}
            {cta ? (
              <Link href={cta.href} className={buttonVariants({ size: "sm" })}>
                {cta.label}
              </Link>
            ) : null}
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-4xl px-6 py-12">{children}</div>
    </div>
  );
}
