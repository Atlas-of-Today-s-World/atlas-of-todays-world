import type { Metadata } from "next";
import ContentRail from "@/components/ContentRail";
import { ErrorState } from "@/components/atlas/ErrorState";
import { LazyCountryQuiz } from "@/features/quiz/LazyCountryQuiz";
import { getT } from "@/lib/i18n/request";

/** The page title in the UI texts (`errors.pageNotFoundTitle`), with the team's changes. */
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).errors.pageNotFoundTitle };
}

/** 404 on map pages — in the panel, the globe stays; the outline quiz below the message. */
export default async function NotFound() {
  const t = await getT();
  return (
    <ContentRail>
      <ErrorState
        code={t.errors.notFoundCode}
        title={t.panel.notFoundTitle}
        lead={t.panel.notFoundText}
        backLabel={t.common.backToGlobe}
      />
      <LazyCountryQuiz />
    </ContentRail>
  );
}
