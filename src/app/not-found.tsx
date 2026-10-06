import { ErrorState } from "@/components/atlas/ErrorState";
import { LazyCountryQuiz } from "@/features/quiz/LazyCountryQuiz";
import { getT } from "@/features/i18n/request";

/** 404 outside the map (pages without the globe, unknown URLs) — with the outline quiz as consolation. */
export default function NotFound() {
  const t = getT();
  return (
    <div className="min-h-dvh bg-white text-[var(--color-ink)]">
      <main id="content" className="mx-auto max-w-2xl py-16">
        <ErrorState
          code="404"
          title={t.errors.pageNotFoundTitle}
          lead={t.errors.pageNotFoundLead}
          backLabel={t.common.backToGlobe}
        />
        <LazyCountryQuiz />
      </main>
    </div>
  );
}
