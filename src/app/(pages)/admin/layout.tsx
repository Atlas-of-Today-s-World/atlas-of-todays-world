import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { can, getAccess, isStaff } from "@/features/auth/access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Brána administrace (ARCHITEKTURA 7.3): bez přihlášení na /login, čtenář bez
 * týmové role dostane „Nemáte přístup". Co kdo uvidí dál, řídí oprávnění z DB;
 * zápisy hlídá RLS.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const access = await getAccess();
  if (!access) redirect("/login?next=/admin");

  if (!isStaff(access.permissions)) {
    return (
      <main className="mx-auto max-w-md" data-testid="admin-forbidden">
        <h1 className="font-display text-[28px] font-bold">Nemáte přístup</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-[var(--color-ink-soft)]">
          Administrace je jen pro tým Atlasu. Do týmu se vstupuje pozvánkou — pokud jste ji dostali,
          přihlaste se stejnou e-mailovou adresou, na kterou přišla.
        </p>
        <p className="mt-6 text-[13px] text-[var(--color-ink-muted)]">
          Přihlášeni jako {access.email}.{" "}
          <Link href="/ucet" className="underline">
            Váš účet
          </Link>
        </p>
      </main>
    );
  }

  const links = [
    { href: "/admin", label: "Obsah", show: true },
    {
      href: "/admin/pozvanky",
      label: "Tým a pozvánky",
      show: can(access.permissions, "users", "v"),
    },
  ].filter((link) => link.show);

  return (
    <div>
      <nav
        aria-label="Administrace"
        className="mb-8 flex flex-wrap items-center gap-4 border-b border-[var(--color-line)] pb-4 text-[13px]"
      >
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="font-medium hover:text-[var(--color-accent)]"
          >
            {link.label}
          </Link>
        ))}
        <span className="ml-auto text-[var(--color-ink-muted)]">
          {access.email} · {access.roleName}
        </span>
        <form action="/auth/signout" method="post">
          <button type="submit" className="min-h-11 px-2 text-[var(--color-ink-soft)] underline">
            Odhlásit
          </button>
        </form>
      </nav>
      {children}
    </div>
  );
}
