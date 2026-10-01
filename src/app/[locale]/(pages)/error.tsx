"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/atlas/ErrorState";
import { Button } from "@/components/ui/button";
import { useMessages } from "@/components/i18n/LocaleProvider";
import { format } from "@/features/i18n/messages";

export default function PagesError({
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
    <ErrorState
      code={error.digest ? format(t.errors.errorCode, { digest: error.digest }) : t.panel.error}
      title={t.errors.pageErrorTitle}
      lead={t.errors.pageErrorLead}
      backLabel={t.common.backToGlobe}
      action={<Button onClick={reset}>{t.panel.tryAgain}</Button>}
    />
  );
}
