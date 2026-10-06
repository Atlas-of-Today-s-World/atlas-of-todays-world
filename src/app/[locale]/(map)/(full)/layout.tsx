import type { ReactNode } from "react";
import { FullPage } from "@/components/FullPage";
import { getFlags } from "@/features/flags/queries";
import { getMessages } from "@/features/i18n/messages";
import { localeFrom } from "@/features/i18n/request";

/**
 * Full-width pages inside the map shell (Topics, encyclopedia entries). The
 * frame lives in the layout, so it doesn't re-run its entrance animation
 * between the loading state and the page or between two entries.
 */
export default async function FullPageLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const [locale, flags] = await Promise.all([localeFrom(params), getFlags()]);
  return (
    <FullPage t={getMessages(locale)} showNews={flags.newsMenu} newsletter={flags.newsletter}>
      {children}
    </FullPage>
  );
}
