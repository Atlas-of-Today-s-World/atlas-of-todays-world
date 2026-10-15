import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/PageHeader";
import { navIcon } from "@/config/admin-nav";
import { adminRoutes } from "@/config/routes";
import { getAccess } from "@/features/auth/access";
import { AccountFacts, OwnData } from "@/features/auth/components/OwnData";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getMessagesFor } from "@/lib/i18n/request";

export const metadata: Metadata = { title: "My account" };

/**
 * The signed-in team member's own account (every team member, no section
 * right needed — the admin layout already let them in): who they are signed in
 * as, the download of their data and deleting the account (GDPR). Readers have
 * the same on /account. The texts are the public site's (`account`, locked in
 * UI texts), so both pages say the same.
 */
export default async function MyAccountPage() {
  const access = await getAccess();
  if (!access) return null;
  const t = (await getMessagesFor(DEFAULT_LOCALE)).account;
  const email = access.email ?? "";

  return (
    <div className="max-w-xl">
      <PageHeader
        title="My account"
        icon={navIcon(adminRoutes.account)}
        lead="Your sign-in and the personal data the Atlas keeps about you."
      />
      <AccountFacts email={email} role={access.roleName} t={t} />
      <OwnData email={email} t={t} />
    </div>
  );
}
