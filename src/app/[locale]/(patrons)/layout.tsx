import { PagesShell } from "@/components/PagesShell";
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
  return (
    <PagesShell t={getMessages(await localeFrom(params))} bleed>
      {children}
    </PagesShell>
  );
}
