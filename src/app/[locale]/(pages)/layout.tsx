import { FloatingDonate } from "@/components/membership/FloatingDonate";
import { PagesShell } from "@/components/PagesShell";
import { getFlags } from "@/features/flags/queries";
import { getMessages } from "@/features/i18n/messages";
import { localeFrom } from "@/features/i18n/request";

/** Simple light layout for the pages outside the map (About, News, Login…). */
export default async function PagesLayout({
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
    >
      {children}
      <FloatingDonate />
    </PagesShell>
  );
}
