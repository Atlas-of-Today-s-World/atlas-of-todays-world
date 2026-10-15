import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import { BrandLogo } from "@/components/atlas/BrandLogo";
import { Lead } from "@/components/atlas/Note";
import { Button } from "@/components/ui/button";
import { RequiredNote } from "@/components/ui/field";
import { ADMIN_NAV, navVisible } from "@/config/admin-nav";
import { getAccess, isStaff } from "@/features/auth/access";
import { MfaGate } from "@/features/auth/components/MfaGate";
import { mfaGate } from "@/features/auth/mfa";
import { routes } from "@/config/routes";
import { privateMetadata } from "@/features/seo/metadata";

export const dynamic = "force-dynamic";

export const metadata = privateMetadata({
  default: "Administration",
  template: "%s — Atlas administration",
});

/**
 * Admin shell (ARCHITEKTURA 5.2, 7.3): without sign-in goes to /login,
 * a reader without a team role gets "No access". Menu from `my_permissions()`;
 * each section also checks the permission itself and RLS guards writes.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const access = await getAccess();
  if (!access) redirect(`${routes.login}?next=${routes.admin}`);

  // A role with mandatory 2FA has no permissions in the DB without the second factor (E10).
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
          <h1 className="font-display text-[28px] font-bold">No access</h1>
          <Lead className="mt-3">
            Administration is for the Atlas team only. You join the team by invitation — if you
            received one, sign in with the same email address it was sent to.
          </Lead>
          <p className="mt-6 text-[13px] text-[var(--color-ink-muted)]">
            Signed in as {access.email}.{" "}
            <Link href={routes.account} className="underline">
              Account settings
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
        <Link href="/" className="flex min-h-(--touch-min) items-center">
          <BrandLogo className="h-5" />
        </Link>
        <span className="text-[13px] font-medium">Administration</span>
        {/* A long address is cut, not wrapped onto a third header row on phones. */}
        <span
          title={`${access.email} · ${access.roleName}`}
          className="ml-auto max-w-[min(60vw,28rem)] min-w-0 truncate text-[12.5px] text-[var(--color-ink-muted)]"
        >
          {access.email} · {access.roleName}
        </span>
        <form action={routes.signOut} method="post">
          <Button type="submit" variant="ghost" size="sm">
            Sign out
          </Button>
        </form>
      </header>
      <div className="md:grid md:grid-cols-[15rem_1fr]">
        <aside className="border-b border-[var(--color-line)] p-3 md:min-h-[calc(100dvh-4rem)] md:border-r md:border-b-0">
          <AdminNav allowed={allowed} />
        </aside>
        <main id="content" tabIndex={-1} className="min-w-0 px-4 py-8 outline-none md:px-10">
          <RequiredNote onlyWithRequiredFields className="mb-3 text-right" />
          {children}
        </main>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-white text-[var(--color-ink)] scheme-light">{children}</div>;
}
