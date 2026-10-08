import { ErrorState } from "@/components/atlas/ErrorState";
import { FloatingActions } from "@/components/membership/FloatingActions";
import { PagesShell } from "@/components/PagesShell";
import { getFlags } from "@/features/flags/queries";
import { getT } from "@/features/i18n/request";
import { LazyCountryQuiz } from "@/features/quiz/LazyCountryQuiz";

/**
 * 404 for unknown addresses of the public site (the catch-all `[...path]`
 * after the redirects table): the site's header and footer, so the visitor can
 * go on from here — with the outline quiz as consolation. Map pages have their
 * own 404 in the panel ((map)/not-found.tsx).
 */
export default async function NotFound() {
  const t = getT();
  const flags = await getFlags();
  return (
    <PagesShell t={t} showNews={flags.newsMenu} newsletter={flags.newsletter}>
      <ErrorState
        code="404"
        title={t.errors.pageNotFoundTitle}
        lead={t.errors.pageNotFoundLead}
        backLabel={t.common.backToGlobe}
      />
      <LazyCountryQuiz />
      <FloatingActions newsletter={flags.newsletter} />
    </PagesShell>
  );
}
