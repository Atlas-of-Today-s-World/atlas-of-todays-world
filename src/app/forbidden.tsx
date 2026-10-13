import Link from "next/link";
import { routes } from "@/config/routes";
import { getAccess } from "@/features/auth/access";

/**
 * 403 for a signed-in account without a team role: the admin layout calls
 * `forbidden()` and the error rises past it to this root boundary (a layout's
 * own `forbidden.tsx` can't catch what the layout throws). Only the admin uses
 * `forbidden()` — its sections have their own boundary in app/admin.
 */
export default async function Forbidden() {
  const access = await getAccess();
  return (
    <div className="min-h-dvh bg-white text-[var(--color-ink)] scheme-light">
      <main id="content" className="mx-auto max-w-md py-16" data-testid="admin-forbidden">
        <h1 className="font-display text-[28px] font-bold">No access</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-[var(--color-ink-soft)]">
          Administration is for the Atlas team only. You join the team by invitation — if you
          received one, sign in with the same email address it was sent to.
        </p>
        {access ? (
          <p className="mt-6 text-[13px] text-[var(--color-ink-muted)]">
            Signed in as {access.email}.{" "}
            <Link href={routes.account} className="underline">
              Your account
            </Link>
          </p>
        ) : null}
      </main>
    </div>
  );
}
