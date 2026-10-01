import ContentRail from "@/components/ContentRail";
import { ErrorState } from "@/components/atlas/ErrorState";
import { CountryQuiz } from "@/features/quiz/CountryQuiz";
import { getT } from "@/features/i18n/request";

/** 404 na mapových stránkách — v panelu, globus zůstává; pod hláškou kvíz obrysů. */
export default function NotFound() {
  const t = getT();
  return (
    <ContentRail>
      <ErrorState
        code="404"
        title={t.panel.notFoundTitle}
        lead={t.panel.notFoundText}
        backLabel={t.common.backToGlobe}
      />
      <CountryQuiz />
    </ContentRail>
  );
}
