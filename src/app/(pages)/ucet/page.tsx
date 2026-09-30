import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccess, isStaff } from "@/features/auth/access";
import DeleteAccount from "./DeleteAccount";

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
        <dt className="text-[var(--color-ink-muted)]">E-mail</dt>
        <dd>{access.email}</dd>
        <dt className="text-[var(--color-ink-muted)]">Role</dt>
        <dd>{access.roleName ?? "Reader"}</dd>
      </dl>

      <div className="mt-8 flex flex-wrap gap-3">
        {staff ? (
          <Link
            href="/admin"
            className="inline-flex min-h-11 items-center rounded-full bg-[var(--color-accent)] px-6 text-[14px] font-medium text-white"
          >
            Open the administration
          </Link>
        ) : null}
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded-full border border-[var(--color-line)] px-6 text-[14px] font-medium"
          >
            Sign out
          </button>
        </form>
      </div>

      <DeleteAccount email={access.email ?? ""} />
    </main>
  );
}
