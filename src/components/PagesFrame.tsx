import type { ReactNode } from "react";
import { FloatingActions } from "@/components/membership/FloatingActions";
import { PagesShell } from "@/components/PagesShell";
import { MaintenanceGate } from "@/features/flags/components/MaintenanceGate";
import { getFlags } from "@/features/flags/queries";
import { getMessages } from "@/features/i18n/messages";
import { localeFrom } from "@/features/i18n/request";

/**
 * Layout body of the light pages outside the map: the (pages) group (About,
 * News, Search…) behind the maintenance switch, and the (account) group
 * (sign-in, invitation, the reader's account) with `gated={false}` — the team
 * must still be able to sign in while the public site is down.
 */
export async function PagesFrame({
  children,
  params,
  gated,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
  gated: boolean;
}) {
  const flags = await getFlags();
  return (
    <PagesShell
      t={getMessages(await localeFrom(params))}
      showNews={flags.newsMenu}
      newsletter={flags.newsletter}
    >
      {gated ? <MaintenanceGate>{children}</MaintenanceGate> : children}
      <FloatingActions newsletter={flags.newsletter} />
    </PagesShell>
  );
}
