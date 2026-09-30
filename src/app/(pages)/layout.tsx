import Link from "next/link";

/** Jednoduchý světlý layout pro stránky mimo mapu (About, News, Support). */
export default function PagesLayout({ children }: { children: React.ReactNode }) {
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
          <nav className="flex items-center gap-5 text-[13px] text-[var(--color-ink-soft)]">
            <Link href="/" className="hover:text-[var(--color-accent)]">
              Map
            </Link>
            <Link href="/news" className="hover:text-[var(--color-accent)]">
              News
            </Link>
            <Link href="/about" className="hover:text-[var(--color-accent)]">
              About
            </Link>
            <Link href="/login" className="hover:text-[var(--color-accent)]">
              Sign in
            </Link>
            <Link
              href="/patrons"
              className="rounded-full bg-[var(--color-accent)] px-4 py-1.5 text-white"
            >
              Atlas Patrons
            </Link>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-4xl px-6 py-12">{children}</div>
    </div>
  );
}
