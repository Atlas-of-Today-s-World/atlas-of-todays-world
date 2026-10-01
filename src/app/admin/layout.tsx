import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import { Button } from "@/components/ui/button";
import { ADMIN_NAV, navVisible } from "@/config/admin-nav";
import { getAccess, isStaff } from "@/features/auth/access";
import { MfaGate } from "@/features/auth/components/MfaGate";
import { mfaGate } from "@/features/auth/mfa";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Administrace", template: "%s — Administrace Atlasu" },
  robots: { index: false, follow: false },
};

/**
 * Shell administrace (ARCHITEKTURA 5.2, 7.3): bez přihlášení na /login,
 * čtenář bez týmové role dostane „Nemáte přístup". Menu z `my_permissions()`;
 * každá sekce si právo ověří i sama a zápisy hlídá RLS.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const access = await getAccess();
  if (!access) redirect("/login?next=/admin");

  // Role s povinným 2FA nemá bez druhého faktoru v DB žádná práva (E10).
  const mfa = await mfaGate();
  if (mfa) {
    return (
      <Shell>
        <MfaGate hasFactor={mfa.hasFactor} />
      </Shell>
    );
  }

  if (!isStaff(access.permissions)) {
    return (
      <Shell>
        <main className="mx-auto max-w-md py-16" data-testid="admin-forbidden">
          <h1 className="font-display text-[28px] font-bold">Nemáte přístup</h1>
          <p className="mt-3 text-[14px] leading-relaxed text-[var(--color-ink-soft)]">
            Administrace je jen pro tým Atlasu. Do týmu se vstupuje pozvánkou — pokud jste ji
            dostali, přihlaste se stejnou e-mailovou adresou, na kterou přišla.
          </p>
          <p className="mt-6 text-[13px] text-[var(--color-ink-muted)]">
            Přihlášeni jako {access.email}.{" "}
            <Link href="/ucet" className="underline">
              Váš účet
            </Link>
          </p>
        </main>
      </Shell>
    );
  }

  const allowed = ADMIN_NAV.filter((item) => navVisible(item, access.permissions)).map(
    (item) => item.href,
  );

  return (
    <Shell>
      <header className="flex flex-wrap items-center gap-3 border-b border-[var(--color-line)] px-4 py-3 md:px-6">
        <Link
          href="/"
          className="font-display rounded-[6px] border border-[#0d1324] px-2.5 py-1 text-[10.5px] font-extrabold tracking-[0.14em] uppercase"
        >
          Atlas
        </Link>
        <span className="text-[13px] font-medium">Administrace</span>
        <span className="ml-auto text-[12.5px] text-[var(--color-ink-muted)]">
          {access.email} · {access.roleName}
        </span>
        <form action="/auth/signout" method="post">
          <Button type="submit" variant="ghost" size="sm">
            Odhlásit
          </Button>
        </form>
      </header>
      <div className="md:grid md:grid-cols-[15rem_1fr]">
        <aside className="border-b border-[var(--color-line)] p-3 md:min-h-[calc(100dvh-4rem)] md:border-r md:border-b-0">
          <AdminNav allowed={allowed} />
        </aside>
        <main id="content" tabIndex={-1} className="min-w-0 px-4 py-8 outline-none md:px-10">
          {children}
        </main>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-white text-[var(--color-ink)]">{children}</div>;
}
