import { redirect } from "next/navigation";
import { getAccess, opensAdmin } from "@/features/auth/access";
import { AccountFacts, OwnData } from "@/features/auth/components/OwnData";
import { localePath } from "@/lib/i18n/config";
import { getMessagesFor, localeFrom } from "@/lib/i18n/request";
import { privateMetadata } from "@/features/seo/metadata";
import { adminRoutes, routes } from "@/config/routes";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[locale]/account">) {
  return privateMetadata((await getMessagesFor(await localeFrom(params))).account.title);
}

/**
 * A reader's account settings (header account menu → "Account settings"):
 * the GDPR self-service a reader can't get in the admin — download of their
 * data and deleting the account. The team has the same under admin → My
 * account, so a team member is sent there.
 */
export default async function AccountPage({ params }: PageProps<"/[locale]/account">) {
  const locale = await localeFrom(params);
  const t = (await getMessagesFor(locale)).account;
  const access = await getAccess();
  if (!access) {
    redirect(
      `${localePath(locale, routes.login)}?next=${encodeURIComponent(localePath(locale, routes.account))}`,
    );
  }
  if (await opensAdmin(access)) redirect(adminRoutes.account);

  return (
    <main className="mx-auto max-w-md">
      <h1 className="font-display text-[28px] font-bold">{t.title}</h1>
      <AccountFacts email={access.email ?? ""} role={null} t={t} />
      <OwnData email={access.email ?? ""} t={t} />
    </main>
  );
}
