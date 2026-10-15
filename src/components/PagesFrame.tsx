import type { ReactNode } from "react";
import { FloatingActions } from "@/components/membership/FloatingActions";
import { PagesShell } from "@/components/PagesShell";
import { MaintenanceGate } from "@/features/flags/components/MaintenanceGate";
import { getFlags } from "@/features/flags/queries";
import { getMessagesFor, localeFrom } from "@/features/i18n/request";

/**
 * Layout body of the light pages outside the map: the (pages) group (About,
 * News, Search…) behind the maintenance switch; the (patrons) group the same
 * with full-width content (`bleed`) and no floating actions; and the (account)
 * group (sign-in, invitation, the reader's account) with `gated={false}` — the
 * team must still be able to sign in while the public site is down.
 */
export async function PagesFrame({
  children,
  params,
  gated,
  bleed = false,
  floatingActions = true,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
  gated: boolean;
  /** Full-width content bands instead of the reading column (PagesShell). */
  bleed?: boolean;
  /** The floating support / newsletter buttons. */
  floatingActions?: boolean;
}) {
  const flags = await getFlags();
  return (
    <PagesShell
      t={await getMessagesFor(await localeFrom(params))}
      newsletter={flags.newsletter}
      bleed={bleed}
    >
      {gated ? <MaintenanceGate>{children}</MaintenanceGate> : children}
      {floatingActions ? <FloatingActions newsletter={flags.newsletter} /> : null}
    </PagesShell>
  );
}
