import { PagesShell } from "@/components/PagesShell";
import { MaintenanceGate } from "@/features/flags/components/MaintenanceGate";
import { getFlags } from "@/features/flags/queries";
import { getMessagesFor, localeFrom } from "@/features/i18n/request";

/** Atlas Patrons pages: same header and footer, full-width content bands. */
export default async function PatronsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const flags = await getFlags();
  return (
    <PagesShell
      t={await getMessagesFor(await localeFrom(params))}
      newsletter={flags.newsletter}
      bleed
    >
      <MaintenanceGate>{children}</MaintenanceGate>
    </PagesShell>
  );
}
