import { ErrorState } from "@/components/atlas/ErrorState";
import { CountryQuiz } from "@/features/quiz/CountryQuiz";

/** 404 mimo mapu (stránky bez globusu, neznámé adresy) — s kvízem obrysů jako útěchou. */
export default function NotFound() {
  return (
    <div className="min-h-dvh bg-white text-[var(--color-ink)]">
      <main id="content" className="mx-auto max-w-2xl py-16">
        <ErrorState
          code="404"
          title="Page not found"
          lead="The page may have moved, or the address has a typo."
        />
        <CountryQuiz />
      </main>
    </div>
  );
}
