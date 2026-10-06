import { PagesShell } from "@/components/PagesShell";
import { getFlags } from "@/features/flags/queries";
import { getMessages } from "@/features/i18n/messages";
import { localeFrom } from "@/features/i18n/request";

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
      t={getMessages(await localeFrom(params))}
      showNews={flags.newsMenu}
      newsletter={flags.newsletter}
      bleed
    >
      {children}
    </PagesShell>
  );
}
