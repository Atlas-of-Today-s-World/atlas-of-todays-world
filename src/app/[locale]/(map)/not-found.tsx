import type { Metadata } from "next";
import ContentRail from "@/components/ContentRail";
import { ErrorState } from "@/components/atlas/ErrorState";
import { LazyCountryQuiz } from "@/features/quiz/LazyCountryQuiz";
import { getT } from "@/features/i18n/request";

export const metadata: Metadata = { title: "Page not found" };

/** 404 on map pages — in the panel, the globe stays; the outline quiz below the message. */
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
      <LazyCountryQuiz />
    </ContentRail>
  );
}
