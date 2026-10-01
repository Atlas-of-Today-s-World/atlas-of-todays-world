import type { Metadata } from "next";
import Link from "@/components/i18n/Link";
import { redirect } from "next/navigation";
import { getAccess, isStaff } from "@/features/auth/access";
import { localePath } from "@/features/i18n/config";
import { getMessages } from "@/features/i18n/messages";
import { localeFrom } from "@/features/i18n/request";
import DeleteAccount from "./DeleteAccount";
import { Button, buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return {
    title: getMessages(await localeFrom(params)).account.title,
    robots: { index: false, follow: false },
  };
}

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await localeFrom(params);
  const t = getMessages(locale).account;
  const access = await getAccess();
  if (!access) {
    redirect(
      `${localePath(locale, "/login")}?next=${encodeURIComponent(localePath(locale, "/ucet"))}`,
    );
  }
  const staff = isStaff(access.permissions);

  return (
    <main className="mx-auto max-w-md">
      <h1 className="font-display text-[28px] font-bold">{t.title}</h1>
      <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[14px]">
        <dt className="text-[var(--color-ink-muted)]">{t.email}</dt>
        <dd>{access.email}</dd>
        <dt className="text-[var(--color-ink-muted)]">{t.role}</dt>
        <dd>{access.roleName ?? t.reader}</dd>
      </dl>

      <div className="mt-8 flex flex-wrap gap-3">
        {staff ? (
          <Link href="/admin" className={buttonVariants()}>
            {t.openAdmin}
          </Link>
        ) : null}
        {/* Stažení vlastních dat (GDPR čl. 15 a 20); obyčejný odkaz, žádný JavaScript. */}
        <a href="/api/account/export" download className={buttonVariants({ variant: "outline" })}>
          {t.download}
        </a>
        <form action="/auth/signout" method="post">
          <Button type="submit" variant="outline">
            {t.signOut}
          </Button>
        </form>
      </div>

      <DeleteAccount email={access.email ?? ""} />
    </main>
  );
}
