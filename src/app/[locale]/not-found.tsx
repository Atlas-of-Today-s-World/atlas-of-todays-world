import type { Metadata } from "next";
import { ErrorState } from "@/components/atlas/ErrorState";
import { FloatingActions } from "@/components/membership/FloatingActions";
import { PagesShell } from "@/components/PagesShell";
import { MaintenanceGate } from "@/components/MaintenanceGate";
import { getFlags } from "@/features/flags/queries";
import { getT } from "@/lib/i18n/request";
import { LazyCountryQuiz } from "@/features/quiz/LazyCountryQuiz";

/** The page title in the UI texts (`errors.pageNotFoundTitle`), with the team's changes. */
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).errors.pageNotFoundTitle };
}

/**
 * 404 for unknown addresses of the public site (the catch-all `[...path]`
 * after the redirects table): the site's header and footer, so the visitor can
 * go on from here — with the outline quiz as consolation. Map pages have their
 * own 404 in the panel ((map)/not-found.tsx).
 */
export default async function NotFound() {
  const t = await getT();
  const flags = await getFlags();
  return (
    <PagesShell t={t} newsletter={flags.newsletter}>
      <MaintenanceGate>
        <ErrorState
          code={t.errors.notFoundCode}
          title={t.errors.pageNotFoundTitle}
          lead={t.errors.pageNotFoundLead}
          backLabel={t.common.backToGlobe}
        />
        <LazyCountryQuiz />
      </MaintenanceGate>
      <FloatingActions newsletter={flags.newsletter} />
    </PagesShell>
  );
}
