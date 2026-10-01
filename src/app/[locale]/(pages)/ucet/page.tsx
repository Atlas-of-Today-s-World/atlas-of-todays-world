import type { Metadata } from "next";
import Link from "@/components/i18n/Link";
import { redirect } from "next/navigation";
import { getAccess, isStaff } from "@/features/auth/access";
import DeleteAccount from "./DeleteAccount";
import { Button, buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const access = await getAccess();
  if (!access) redirect("/login?next=/ucet");
  const staff = isStaff(access.permissions);

  return (
    <main className="mx-auto max-w-md">
      <h1 className="font-display text-[28px] font-bold">Your account</h1>
      <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[14px]">
        <dt className="text-[var(--color-ink-muted)]">Email</dt>
        <dd>{access.email}</dd>
        <dt className="text-[var(--color-ink-muted)]">Role</dt>
        <dd>{access.roleName ?? "Reader"}</dd>
      </dl>

      <div className="mt-8 flex flex-wrap gap-3">
        {staff ? (
          <Link href="/admin" className={buttonVariants()}>
            Open the administration
          </Link>
        ) : null}
        {/* Stažení vlastních dat (GDPR čl. 15 a 20); obyčejný odkaz, žádný JavaScript. */}
        <a href="/api/account/export" download className={buttonVariants({ variant: "outline" })}>
          Download my data
        </a>
        <form action="/auth/signout" method="post">
          <Button type="submit" variant="outline">
            Sign out
          </Button>
        </form>
      </div>

      <DeleteAccount email={access.email ?? ""} />
    </main>
  );
}
