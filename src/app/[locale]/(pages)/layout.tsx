import Link from "@/components/i18n/Link";
import { buttonVariants } from "@/components/ui/button";
import { ACCOUNT_NAV, LEGAL_NAV, MAIN_NAV } from "@/config/navigation";
import { getMessages } from "@/features/i18n/messages";
import { localeFrom } from "@/features/i18n/request";

/** Simple light layout for pages outside the map (About, News, Support). */
export default async function PagesLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const t = getMessages(await localeFrom(params));
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
            aria-label={t.header.main}
            className="flex flex-wrap items-center gap-x-5 text-[13px] text-[var(--color-ink-soft)]"
          >
            {links.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-h-11 items-center hover:text-[var(--color-accent)]"
              >
                {t.nav[item.key]}
              </Link>
            ))}
            {cta ? (
              <Link href={cta.href} className={buttonVariants({ size: "sm" })}>
                {t.nav[cta.key]}
              </Link>
            ) : null}
          </nav>
        </div>
      </header>
      <div id="content" tabIndex={-1} className="mx-auto max-w-4xl px-6 py-12 outline-none">
        {children}
      </div>
      <footer className="border-t border-[var(--color-line)]">
        <nav
          aria-label={t.header.legal}
          className="mx-auto flex max-w-4xl flex-wrap gap-x-5 px-6 py-4 text-[12.5px] text-[var(--color-ink-muted)]"
        >
          <span>© Atlas of Today&rsquo;s World</span>
          {LEGAL_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-h-11 items-center hover:text-[var(--color-accent)]"
            >
              {t.nav[item.key]}
            </Link>
          ))}
        </nav>
      </footer>
    </div>
  );
}
