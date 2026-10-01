"use client";

import { useEffect } from "react";
import ContentRail from "@/components/ContentRail";
import { ErrorState } from "@/components/atlas/ErrorState";
import { Button } from "@/components/ui/button";
import { useMessages } from "@/components/i18n/LocaleProvider";

/** Error loading the panel content — the globe stays and you can try again. */
export default function MapError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useMessages();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <ContentRail>
      <ErrorState
        code={error.digest ? `${t.panel.error} ${error.digest}` : t.panel.error}
        title={t.panel.errorTitle}
        lead={t.panel.errorText}
        backLabel={t.common.backToGlobe}
        action={<Button onClick={reset}>{t.panel.tryAgain}</Button>}
      />
    </ContentRail>
  );
}
