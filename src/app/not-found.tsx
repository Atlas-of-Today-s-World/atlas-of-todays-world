import { ErrorState } from "@/components/atlas/ErrorState";
import { CountryQuiz } from "@/features/quiz/CountryQuiz";
import { getT } from "@/features/i18n/request";

/** 404 mimo mapu (stránky bez globusu, neznámé adresy) — s kvízem obrysů jako útěchou. */
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
        <CountryQuiz />
      </main>
    </div>
  );
}
